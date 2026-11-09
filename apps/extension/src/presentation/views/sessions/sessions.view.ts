import {getProjectListItemForSessionsView, listProjectsForSessionsView} from "@controllers/project.controller.ts";
import {
  getSessionListItemForSessionsView,
  listProjectSessionIdsForSessionsView,
  listWorkingSessionIdsForSessionsView,
  watchActivatedSessionIdsForSessionsView,
  watchSessionListChangesForSessionsView
} from "@controllers/session.controller.ts";
import {
  SESSION_BADGE_URI_SCHEME,
  SESSIONS_VIEW_ID,
  SPINNER_FRAME_INTERVAL_MS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireDisposable} from "@pkg/vscode/src/vscode.utils.ts";
import {
  makeProjectNodeId,
  makeSessionNodeId,
  readSessionsTreeNodeId
} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  createProjectTreeItem,
  createSessionTreeItem,
  createStatusBadge,
  getSessionBadgeUri
} from "@views/sessions/sessions.utils.ts";
import {Effect, Layer, Match, Schedule, Schema, Stream, String} from "effect";

import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {EventEmitter, TreeView, Uri} from "vscode";

// VS Code calls the tree and badge callbacks for every row on every redraw and spinner frame, so they run untraced.
type RunPromiseUntraced = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => Promise<A>;

// The tree's nodes are ids (see sessionsTreeNode.utils.ts): VS Code finds the node to redraw by its id, and every draw
// reads the node's project or session again through the controllers, so the view keeps no copy of them.
interface SessionsViewHandles {
  readonly badgesChangedEmitter: EventEmitter<Uri[]>;
  readonly sessionsTreeView: TreeView<string>;
  readonly treeChangedEmitter: EventEmitter<string | undefined>;
}

type SessionsViewServices =
  | Effect.Services<
      ReturnType<
        typeof createNodeTreeItem | typeof createSessionBadge | typeof findParentNodeId | typeof listChildNodeIds
      >
    >
  | VsCodeApi;

class RevealFailedError extends Schema.TaggedError<RevealFailedError, {readonly brand: unique symbol}>()(
  "RevealFailedError",
  {cause: Schema.Unknown}
) {}

// Selects the session whose tab became active. Skipped while the view is hidden, since reveal would open it.
const revealSession = Effect.fn("SessionsView.revealSession")(
  function* (sessionsTreeView: TreeView<string>, sessionId: string) {
    if (!sessionsTreeView.visible) return;
    const sessionNodeId = yield* makeSessionNodeId(sessionId);

    yield* Effect.tryPromise({
      catch: (cause) => RevealFailedError.make({cause}),
      try: () => sessionsTreeView.reveal(sessionNodeId, {focus: false, select: true})
    });
  },
  Effect.ignore({log: "Warn", message: "Could not select the active session in the Sessions view"})
);

const makeUntracedRunner = Effect.fn("SessionsView.makeUntracedRunner")(function* () {
  const sessionsViewContext = yield* Effect.context<SessionsViewServices>();
  const runPromise = Effect.runPromiseWith(sessionsViewContext);
  const runPromiseUntraced: RunPromiseUntraced = (effect) => runPromise(Effect.withTracerEnabled(effect, false));

  return runPromiseUntraced;
});

// The projects at the top, each project's sessions under it. A failed read is logged and leaves the level empty.
const listChildNodeIds = Effect.fn("SessionsView.listChildNodeIds")(
  function* (parentNodeId: string | undefined) {
    if (parentNodeId === undefined) {
      const projectListItems = yield* listProjectsForSessionsView();

      return yield* Effect.forEach(projectListItems, (projectListItem) => makeProjectNodeId(projectListItem.path));
    }
    const parentNode = yield* readSessionsTreeNodeId(parentNodeId);
    if (parentNode._tag === "SessionNode") return [];
    const sessionIds = yield* listProjectSessionIdsForSessionsView(parentNode.projectPath);

    return yield* Effect.forEach(sessionIds, (sessionId) => makeSessionNodeId(sessionId));
  },
  Effect.catch((readError) => Effect.as(Effect.logWarning("Could not read the Sessions view's rows", readError), []))
);

const createEmptyTreeItem = Effect.fn("SessionsView.createEmptyTreeItem")(function* () {
  const {TreeItem} = yield* VsCodeApi;

  return new TreeItem("");
});

// A row removed meanwhile draws empty until the change that removed it redraws its project; another failed read is
// logged too.
const createNodeTreeItem = Effect.fn("SessionsView.createNodeTreeItem")(
  function* (nodeId: string) {
    const node = yield* readSessionsTreeNodeId(nodeId);
    if (node._tag === "ProjectNode") {
      const projectListItem = yield* getProjectListItemForSessionsView(node.projectPath);

      return yield* createProjectTreeItem(projectListItem);
    }
    const sessionListItem = yield* getSessionListItemForSessionsView(node.sessionId);

    return yield* createSessionTreeItem(sessionListItem);
  },
  Effect.catchTags({
    ProjectNotListedError: () => createEmptyTreeItem(),
    SessionNotFoundError: () => createEmptyTreeItem()
  }),
  Effect.catch((readError) =>
    Effect.andThen(Effect.logWarning("Could not read a Sessions view row", readError), createEmptyTreeItem())
  )
);

// A session's parent is its project, which VS Code needs to reveal it.
const findParentNodeId = Effect.fn("SessionsView.findParentNodeId")(
  function* (nodeId: string) {
    const node = yield* readSessionsTreeNodeId(nodeId);
    if (node._tag === "ProjectNode") return undefined;
    const sessionListItem = yield* getSessionListItemForSessionsView(node.sessionId);

    return yield* makeProjectNodeId(sessionListItem.projectPath);
  },
  Effect.catch((readError) => Effect.as(Effect.logWarning("Could not read a session's project", readError), undefined))
);

const createSessionBadge = Effect.fn("SessionsView.createSessionBadge")(
  function* (sessionId: string) {
    const sessionListItem = yield* getSessionListItemForSessionsView(sessionId);

    return yield* createStatusBadge(sessionListItem.status);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.undefined),
  Effect.catch((readError) => Effect.as(Effect.logWarning("Could not read a session's status", readError), undefined))
);

// Each session row's status badge is a file decoration on its URI.
const registerStatusBadges = Effect.fn("SessionsView.registerStatusBadges")(function* (
  runPromiseUntraced: RunPromiseUntraced
) {
  const {EventEmitter, window} = yield* VsCodeApi;
  const badgesChangedEmitter = yield* acquireDisposable(() => new EventEmitter<Uri[]>());
  yield* acquireDisposable(() =>
    window.registerFileDecorationProvider({
      onDidChangeFileDecorations: badgesChangedEmitter.event,
      // VS Code asks about every file it shows, so anything not ours returns before running an effect.
      provideFileDecoration: (uri) =>
        uri.scheme === SESSION_BADGE_URI_SCHEME
          ? runPromiseUntraced(createSessionBadge(String.slice(1)(uri.path)))
          : undefined
    })
  );

  return badgesChangedEmitter;
});

const registerTreeView = Effect.fn("SessionsView.registerTreeView")(function* (runPromiseUntraced: RunPromiseUntraced) {
  const {EventEmitter, window} = yield* VsCodeApi;
  const treeChangedEmitter = yield* acquireDisposable(() => new EventEmitter<string | undefined>());
  const sessionsTreeView = yield* acquireDisposable(() =>
    window.createTreeView<string>(SESSIONS_VIEW_ID, {
      treeDataProvider: {
        getChildren: (parentNodeId) =>
          runPromiseUntraced(Effect.map(listChildNodeIds(parentNodeId), (childNodeIds) => [...childNodeIds])),
        getParent: (nodeId) => runPromiseUntraced(findParentNodeId(nodeId)),
        getTreeItem: (nodeId) => runPromiseUntraced(createNodeTreeItem(nodeId)),
        onDidChangeTreeData: treeChangedEmitter.event
      }
    })
  );

  return {sessionsTreeView, treeChangedEmitter};
});

// Redraws only what changed: the whole tree for the project list, one project for its sessions, or one session's row
// and badge.
const redrawChangedNodes = Effect.fn("SessionsView.redrawChangedNodes")(function* (
  sessionsViewHandles: SessionsViewHandles,
  sessionListChange: SessionListChangeDto
) {
  const changedNodeId = yield* Match.valueTags(sessionListChange, {
    ProjectListChanged: () => Effect.undefined,
    ProjectSessionsChanged: ({projectPath}) => makeProjectNodeId(projectPath),
    SessionChanged: ({sessionId}) => makeSessionNodeId(sessionId)
  });
  const changedBadgeUris =
    sessionListChange._tag === "SessionChanged" ? [yield* getSessionBadgeUri(sessionListChange.sessionId)] : [];

  yield* Effect.sync(() => {
    sessionsViewHandles.treeChangedEmitter.fire(changedNodeId);
    if (changedBadgeUris.length > 0) sessionsViewHandles.badgesChangedEmitter.fire(changedBadgeUris);
  });
});

// shortcut: ticks for the view's whole life and reads the working sessions each frame while it is visible. Start and stop
// it on status changes if those reads ever show up in a profile. A failed read skips the frame.
const advanceSpinnerFrames = Effect.fn("SessionsView.advanceSpinnerFrames")(
  function* (sessionsViewHandles: SessionsViewHandles) {
    if (!sessionsViewHandles.sessionsTreeView.visible) return;
    const workingSessionIds = yield* listWorkingSessionIdsForSessionsView();
    if (workingSessionIds.length === 0) return;

    const workingBadgeUris = yield* Effect.forEach(workingSessionIds, (sessionId) => getSessionBadgeUri(sessionId));
    yield* Effect.sync(() => {
      sessionsViewHandles.badgesChangedEmitter.fire(workingBadgeUris);
    });
  },
  (effect) => Effect.ignore(effect)
);

// Registers the Sessions tree for the lifetime of the runtime; disposing the runtime unregisters it.
const makeSessionsView = Effect.fn("SessionsView.make")(function* () {
  const runPromiseUntraced = yield* makeUntracedRunner();
  const sessionsViewHandles: SessionsViewHandles = {
    badgesChangedEmitter: yield* registerStatusBadges(runPromiseUntraced),
    ...(yield* registerTreeView(runPromiseUntraced))
  };
  const sessionListChanges = yield* watchSessionListChangesForSessionsView();
  const activatedSessionIds = yield* watchActivatedSessionIdsForSessionsView();
  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      redrawChangedNodes(sessionsViewHandles, sessionListChange)
    )
  );
  yield* Effect.forkScoped(
    Effect.withTracerEnabled(
      Effect.repeat(advanceSpinnerFrames(sessionsViewHandles), Schedule.spaced(SPINNER_FRAME_INTERVAL_MS)),
      false
    )
  );
  yield* Effect.forkScoped(
    Stream.runForEach(activatedSessionIds, (sessionId) =>
      revealSession(sessionsViewHandles.sessionsTreeView, sessionId)
    )
  );
});

export const SessionsView = Layer.effectDiscard(makeSessionsView());
