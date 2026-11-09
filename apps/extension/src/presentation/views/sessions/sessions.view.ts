import {getProjectListItemForSessionsView, listProjectsForSessionsView} from "@controllers/project.controller.ts";
import {
  findViewedSessionIdForSessionsView,
  getSessionListItemForSessionsView,
  listProjectSessionIdsForSessionsView,
  listWorkingSessionIdsForSessionsView,
  watchSessionListChangesForSessionsView,
  watchViewedSessionIdsForSessionsView
} from "@controllers/session.controller.ts";
import {
  SELECT_ROW_RETRIES,
  SELECT_ROW_RETRY_INTERVAL_MS,
  SESSION_BADGE_URI_SCHEME,
  SESSIONS_VIEW_ID,
  SPINNER_FRAME_INTERVAL_MS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
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

// The tree's nodes are ids (see sessionsTreeNode.utils.ts): VS Code finds the node to redraw by its id, and every draw
// reads the node's project or session again through the controllers, so the view keeps no copy of them.
interface SessionsViewHandles {
  readonly badgesChangedEmitter: EventEmitter<Uri[]>;
  readonly sessionsTreeView: TreeView<string>;
  readonly treeChangedEmitter: EventEmitter<string | undefined>;
}

class RevealFailedError extends Schema.TaggedError<RevealFailedError, {readonly brand: unique symbol}>()(
  "RevealFailedError",
  {cause: Schema.Unknown}
) {}

const revealRow = Effect.fn("SessionsView.revealRow")(function* (sessionsTreeView: TreeView<string>, nodeId: string) {
  yield* Effect.tryPromise({
    catch: (cause) => RevealFailedError.make({cause}),
    try: () => sessionsTreeView.reveal(nodeId, {focus: false, select: true})
  });
});

// The row of the session whose tab is in front stays selected, whatever else the user clicks in the view. A new
// session's row is drawn a moment after its tab opens, so the reveal is retried. Skipped while the view is hidden,
// since reveal would open it, while no session's tab is in front, and for a session removed while its tab closes.
const selectViewedSession = Effect.fn("SessionsView.selectViewedSession")(
  function* (sessionsTreeView: TreeView<string>) {
    if (!sessionsTreeView.visible) return;
    const viewedSessionId = yield* findViewedSessionIdForSessionsView();
    const sessionNodeId = yield* makeSessionNodeId(viewedSessionId);
    const {selection} = sessionsTreeView;
    if (selection.length === 1 && selection[0] === sessionNodeId) return;
    yield* getSessionListItemForSessionsView(viewedSessionId);

    yield* Effect.retry(revealRow(sessionsTreeView, sessionNodeId), {
      schedule: Schedule.spaced(SELECT_ROW_RETRY_INTERVAL_MS),
      times: SELECT_ROW_RETRIES
    });
  },
  Effect.catchTags({NoViewedSessionError: () => Effect.void, SessionNotFoundError: () => Effect.void}),
  Effect.catch((revealError) =>
    Effect.logWarning("Could not select the session in front in the Sessions view", revealError)
  )
);

// Choosing a session row opens that session, which brings it to the front a moment later; putting the selection back in
// between would flick it to the old row and back. A broken node id counts as no session row.
const isSessionRowSelected = Effect.fn("SessionsView.isSessionRowSelected")(
  function* (selectedNodeIds: readonly string[]) {
    const [selectedNodeId] = selectedNodeIds;
    if (selectedNodeId === undefined) return false;
    const selectedNode = yield* readSessionsTreeNodeId(selectedNodeId);

    return selectedNode._tag === "SessionNode";
  },
  Effect.catchTag("InvalidVsCodeArgumentError", () => Effect.succeed(false))
);

// The viewed session changes, the user selects a project row or nothing, or the view comes into sight: each time, the
// session in front gets its row selected again, one at a time.
const keepViewedSessionSelected = Effect.fn("SessionsView.keepViewedSessionSelected")(function* (
  sessionsTreeView: TreeView<string>
) {
  const viewedSessionIds = yield* watchViewedSessionIdsForSessionsView();
  const selectionChanges = yield* streamVsCodeEvent(sessionsTreeView.onDidChangeSelection);
  const visibilityChanges = yield* streamVsCodeEvent(sessionsTreeView.onDidChangeVisibility);
  const otherRowSelections = Stream.filterEffect(selectionChanges, ({selection}) =>
    Effect.map(isSessionRowSelected(selection), (isSessionRow) => !isSessionRow)
  );
  const reselectTriggers = [
    Stream.as(viewedSessionIds, undefined),
    Stream.as(otherRowSelections, undefined),
    Stream.as(visibilityChanges, undefined)
  ];

  yield* Stream.runForEach(Stream.mergeAll(reselectTriggers, {concurrency: "unbounded"}), () =>
    selectViewedSession(sessionsTreeView)
  );
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
  Effect.catchTag("SessionNotFoundError", () => Effect.undefined),
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

// What the tree and badge callbacks need to run.
type SessionsViewServices =
  | Effect.Services<
      ReturnType<
        typeof createNodeTreeItem | typeof createSessionBadge | typeof findParentNodeId | typeof listChildNodeIds
      >
    >
  | VsCodeApi;

// VS Code calls the tree and badge callbacks for every row on every redraw and spinner frame, so they run untraced.
type RunPromiseUntraced = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => Promise<A>;

const makeUntracedRunner = Effect.fn("SessionsView.makeUntracedRunner")(function* () {
  const sessionsViewContext = yield* Effect.context<SessionsViewServices>();
  const runPromise = Effect.runPromiseWith(sessionsViewContext);
  const runPromiseUntraced: RunPromiseUntraced = (effect) => runPromise(Effect.withTracerEnabled(effect, false));

  return runPromiseUntraced;
});

// Each session row's status badge is a file decoration on its URI.
const registerStatusBadges = Effect.fn("SessionsView.registerStatusBadges")(function* (
  runPromiseUntraced: RunPromiseUntraced
) {
  const {EventEmitter, window} = yield* VsCodeApi;
  const badgesChangedEmitter = yield* acquireScopedDisposable(() => new EventEmitter<Uri[]>());
  yield* acquireScopedDisposable(() =>
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
  const treeChangedEmitter = yield* acquireScopedDisposable(() => new EventEmitter<string | undefined>());
  const sessionsTreeView = yield* acquireScopedDisposable(() =>
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
  yield* Effect.forkScoped(keepViewedSessionSelected(sessionsViewHandles.sessionsTreeView));
});

export const SessionsView = Layer.effectDiscard(makeSessionsView());
