import {getProjectListItemForArchiveView} from "@controllers/project.controller.ts";
import {
  getSessionListItemForArchiveView,
  listProjectSessionIdsForArchiveView,
  listProjectsForArchiveView,
  listSessionsWaitingOnUserForArchiveView,
  listWorkingSessionIdsForArchiveView,
  watchSessionListChangesForArchiveView
} from "@controllers/session.controller.ts";
import {ARCHIVE_VIEW, ARCHIVE_VIEW_LABELS} from "@pkg/constants/src/archiveView.constant.ts";
import {
  SESSION_BADGE_URI_SCHEME,
  SESSIONS_VIEW_NODE_TAGS,
  SPINNER_FRAME_INTERVAL_MS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable} from "@pkg/vscode/src/vscode.utils.ts";
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
} from "@views/archive/archive.utils.ts";
import {countViewSessionsWaitingOnUser} from "@views/sessions/sessions.utils.ts";
import {Effect, Layer, Match, Schedule, Stream, String} from "effect";

import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {EventEmitter, TreeView, Uri} from "vscode";

// The Archive tree: the sessions the user is done with, under their projects. Its nodes are ids (see
// sessionsTreeNode.utils.ts), read again through the controllers on every draw, and each session row's status badge is a
// file decoration on the row's URI.
interface ArchiveViewHandles {
  readonly archiveTreeView: TreeView<string>;
  readonly badgesChangedEmitter: EventEmitter<Uri[]>;
  readonly treeChangedEmitter: EventEmitter<string | undefined>;
}

// The projects with an archived session at the top, each project's archived sessions under it. A failed read is logged
// and leaves the level empty.
const listChildNodeIds = Effect.fn("ArchiveView.listChildNodeIds")(
  function* (parentNodeId: string | undefined) {
    if (parentNodeId === undefined) {
      const projectListItems = yield* listProjectsForArchiveView();

      return yield* Effect.forEach(projectListItems, (projectListItem) => makeProjectNodeId(projectListItem.path));
    }
    const parentNode = yield* readSessionsTreeNodeId(parentNodeId);

    return yield* Match.valueTags(parentNode, {
      [SESSIONS_VIEW_NODE_TAGS.PROJECT]: (projectNode) =>
        Effect.flatMap(listProjectSessionIdsForArchiveView(projectNode.projectPath), (sessionIds) =>
          Effect.forEach(sessionIds, (sessionId) => makeSessionNodeId(sessionId))
        ),
      [SESSIONS_VIEW_NODE_TAGS.SESSION]: () => Effect.succeed([])
    });
  },
  Effect.catch((readError) => Effect.as(Effect.logWarning("Could not read the Archive view's rows", readError), []))
);

const createEmptyTreeItem = Effect.fn("ArchiveView.createEmptyTreeItem")(function* () {
  const vsCodeApi = yield* VsCodeApi;

  return new vsCodeApi.TreeItem("");
});

// A project row has no buttons here, since the manifest's project menus are the Sessions view's. A row removed
// meanwhile draws empty until the change that removed it redraws the tree; another failed read is logged too.
const createNodeTreeItem = Effect.fn("ArchiveView.createNodeTreeItem")(
  function* (nodeId: string) {
    const node = yield* readSessionsTreeNodeId(nodeId);

    return yield* Match.valueTags(node, {
      [SESSIONS_VIEW_NODE_TAGS.PROJECT]: (projectNode) =>
        Effect.flatMap(getProjectListItemForArchiveView(projectNode.projectPath), (projectListItem) =>
          createProjectTreeItem(projectListItem)
        ),
      [SESSIONS_VIEW_NODE_TAGS.SESSION]: (sessionNode) =>
        Effect.flatMap(getSessionListItemForArchiveView(sessionNode.sessionId), (sessionListItem) =>
          createSessionTreeItem(sessionListItem)
        )
    });
  },
  Effect.catchTags({
    ProjectNotListedError: () => createEmptyTreeItem(),
    SessionNotFoundError: () => createEmptyTreeItem()
  }),
  Effect.catch((readError) =>
    Effect.andThen(Effect.logWarning("Could not read an Archive view row", readError), createEmptyTreeItem())
  )
);

const createSessionBadge = Effect.fn("ArchiveView.createSessionBadge")(
  function* (sessionId: string) {
    const sessionListItem = yield* getSessionListItemForArchiveView(sessionId);

    return yield* createStatusBadge(sessionListItem.status);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.undefined),
  Effect.catch((readError) => Effect.as(Effect.logWarning("Could not read a session's status", readError), undefined))
);

// What the tree and badge callbacks need to run.
type ArchiveViewServices =
  | Effect.Services<ReturnType<typeof createNodeTreeItem | typeof createSessionBadge | typeof listChildNodeIds>>
  | VsCodeApi;

type RunPromiseUntraced = <A, E>(effect: Effect.Effect<A, E, ArchiveViewServices>) => Promise<A>;

// VS Code calls the tree and badge callbacks for every row on every redraw and spinner frame, so they run untraced.
const makeRunPromiseUntraced = Effect.fn("ArchiveView.makeRunPromiseUntraced")(function* () {
  const archiveViewContext = yield* Effect.context<ArchiveViewServices>();
  const runPromiseUntraced: RunPromiseUntraced = (effect) =>
    Effect.runPromiseWith(archiveViewContext)(Effect.withTracerEnabled(effect, false));

  return runPromiseUntraced;
});

// Each session row's status badge is a file decoration on its URI.
const registerStatusBadges = Effect.fn("ArchiveView.registerStatusBadges")(function* (
  runPromiseUntraced: RunPromiseUntraced
) {
  const vsCodeApi = yield* VsCodeApi;
  const badgesChangedEmitter = yield* acquireScopedDisposable(() => new vsCodeApi.EventEmitter<Uri[]>());
  yield* acquireScopedDisposable(() =>
    vsCodeApi.window.registerFileDecorationProvider({
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

const registerTreeView = Effect.fn("ArchiveView.registerTreeView")(function* (runPromiseUntraced: RunPromiseUntraced) {
  const vsCodeApi = yield* VsCodeApi;
  const treeChangedEmitter = yield* acquireScopedDisposable(() => new vsCodeApi.EventEmitter<string | undefined>());
  const archiveTreeView = yield* acquireScopedDisposable(() =>
    vsCodeApi.window.createTreeView<string>(ARCHIVE_VIEW.ID, {
      treeDataProvider: {
        getChildren: (parentNodeId) =>
          runPromiseUntraced(Effect.map(listChildNodeIds(parentNodeId), (childNodeIds) => [...childNodeIds])),
        getTreeItem: (nodeId) => runPromiseUntraced(createNodeTreeItem(nodeId)),
        onDidChangeTreeData: treeChangedEmitter.event
      }
    })
  );

  return {archiveTreeView, treeChangedEmitter};
});

// A session's own change redraws its row and badge. Anything else redraws the whole tree: a project's row comes and goes
// with its archived sessions, so archiving or unarchiving one can add or drop a project.
const redrawChangedNodes = Effect.fn("ArchiveView.redrawChangedNodes")(function* (
  archiveViewHandles: ArchiveViewHandles,
  sessionListChange: SessionListChangeDto
) {
  const changedNodeId = yield* Match.valueTags(sessionListChange, {
    ProjectListChanged: () => Effect.undefined,
    ProjectSessionsChanged: () => Effect.undefined,
    SessionChanged: (sessionChanged) => makeSessionNodeId(sessionChanged.sessionId)
  });
  const changedBadgeUris = yield* Match.valueTags(sessionListChange, {
    ProjectListChanged: () => Effect.succeed([]),
    ProjectSessionsChanged: () => Effect.succeed([]),
    SessionChanged: (sessionChanged) =>
      Effect.map(getSessionBadgeUri(sessionChanged.sessionId), (sessionBadgeUri) => [sessionBadgeUri])
  });

  yield* Effect.sync(() => {
    archiveViewHandles.treeChangedEmitter.fire(changedNodeId);
    if (changedBadgeUris.length > 0) archiveViewHandles.badgesChangedEmitter.fire(changedBadgeUris);
  });
});

// The count in the view's name: the archived sessions waiting on the user. A failed read leaves it as it was.
const updateWaitingCount = Effect.fn("ArchiveView.updateWaitingCount")(
  function* (archiveTreeView: TreeView<string>) {
    const sessionsWaitingOnUser = yield* listSessionsWaitingOnUserForArchiveView();
    const waitingCount = yield* countViewSessionsWaitingOnUser(sessionsWaitingOnUser, true);

    yield* Effect.sync(() => {
      archiveTreeView.title =
        waitingCount === 0 ? ARCHIVE_VIEW_LABELS.TITLE : ARCHIVE_VIEW_LABELS.TITLE_WITH_WAITING_COUNT(waitingCount);
    });
  },
  Effect.ignore({log: "Debug", message: "Could not update the Archive view's name"})
);

// shortcut: ticks for the view's whole life and reads the working sessions each frame while it is visible. Start and stop
// it on status changes if those reads ever show up in a profile. A failed read skips the frame.
const advanceSpinnerFrames = Effect.fn("ArchiveView.advanceSpinnerFrames")(
  function* (archiveViewHandles: ArchiveViewHandles) {
    if (!archiveViewHandles.archiveTreeView.visible) return;
    const workingSessionIds = yield* listWorkingSessionIdsForArchiveView();
    if (workingSessionIds.length === 0) return;

    const workingBadgeUris = yield* Effect.forEach(workingSessionIds, (sessionId) => getSessionBadgeUri(sessionId));
    yield* Effect.sync(() => {
      archiveViewHandles.badgesChangedEmitter.fire(workingBadgeUris);
    });
  },
  Effect.ignore({log: "Debug", message: "Could not advance the Archive view's spinners"})
);

// Registers the Archive tree for the lifetime of the runtime; disposing the runtime unregisters it.
const makeArchiveView = Effect.fn("ArchiveView.make")(function* () {
  const runPromiseUntraced = yield* makeRunPromiseUntraced();
  const archiveViewHandles: ArchiveViewHandles = {
    badgesChangedEmitter: yield* registerStatusBadges(runPromiseUntraced),
    ...(yield* registerTreeView(runPromiseUntraced))
  };
  const sessionListChanges = yield* watchSessionListChangesForArchiveView();
  yield* updateWaitingCount(archiveViewHandles.archiveTreeView);

  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      Effect.andThen(
        redrawChangedNodes(archiveViewHandles, sessionListChange),
        updateWaitingCount(archiveViewHandles.archiveTreeView)
      )
    )
  );
  yield* Effect.forkScoped(
    Effect.withTracerEnabled(
      Effect.repeat(advanceSpinnerFrames(archiveViewHandles), Schedule.spaced(SPINNER_FRAME_INTERVAL_MS)),
      false
    )
  );
});

export const ArchiveView = Layer.effectDiscard(makeArchiveView());
