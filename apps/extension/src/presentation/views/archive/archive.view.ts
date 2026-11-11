import {getProjectListItemForArchiveView} from "@controllers/project.controller.ts";
import {
  getSessionListItemForArchiveView,
  listProjectSessionIdsForArchiveView,
  listProjectsForArchiveView,
  listSessionsWaitingOnUserForArchiveView,
  watchSessionListChangesForArchiveView
} from "@controllers/session.controller.ts";
import {ARCHIVE_VIEW, ARCHIVE_VIEW_LABELS} from "@pkg/constants/src/archiveView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable} from "@pkg/vscode/src/vscode.utils.ts";
import {
  makeProjectNodeId,
  makeSessionNodeId,
  readSessionsTreeNodeId
} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  countViewSessionsWaitingOnUser,
  createProjectTreeItem,
  createSessionTreeItem
} from "@views/sessions/sessions.utils.ts";
import {Effect, Layer, Match, Stream} from "effect";

import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {EventEmitter, TreeView} from "vscode";

// The Archive tree: the sessions the user is done with, under their projects, drawn as the Sessions tree draws them.
// Its nodes are the Sessions tree's ids (see sessionsTreeNode.utils.ts), read again through the controllers on every
// draw, and each session row's status badge comes from the Sessions view's provider, which draws every session's.

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
      ProjectNode: ({projectPath}) =>
        Effect.flatMap(listProjectSessionIdsForArchiveView(projectPath), (sessionIds) =>
          Effect.forEach(sessionIds, (sessionId) => makeSessionNodeId(sessionId))
        ),
      SessionNode: () => Effect.succeed([])
    });
  },
  Effect.catch((readError) => Effect.as(Effect.logWarning("Could not read the Archive view's rows", readError), []))
);

const createEmptyTreeItem = Effect.fn("ArchiveView.createEmptyTreeItem")(function* () {
  const {TreeItem} = yield* VsCodeApi;

  return new TreeItem("");
});

// A project row has no buttons here, since the manifest's project menus are the Sessions view's. A row removed
// meanwhile draws empty until the change that removed it redraws the tree; another failed read is logged too.
const createNodeTreeItem = Effect.fn("ArchiveView.createNodeTreeItem")(
  function* (nodeId: string) {
    const node = yield* readSessionsTreeNodeId(nodeId);

    return yield* Match.valueTags(node, {
      ProjectNode: ({projectPath}) =>
        Effect.flatMap(getProjectListItemForArchiveView(projectPath), (projectListItem) =>
          createProjectTreeItem(projectListItem)
        ),
      SessionNode: ({sessionId}) =>
        Effect.flatMap(getSessionListItemForArchiveView(sessionId), (sessionListItem) =>
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

// What the tree's callbacks need to run.
type ArchiveViewServices = Effect.Services<ReturnType<typeof createNodeTreeItem | typeof listChildNodeIds>> | VsCodeApi;

// VS Code calls the tree's callbacks for every row on every redraw, so they run untraced.
const registerTreeView = Effect.fn("ArchiveView.registerTreeView")(function* () {
  const {EventEmitter, window} = yield* VsCodeApi;
  const archiveViewContext = yield* Effect.context<ArchiveViewServices>();
  const runPromiseUntraced = <A, E>(effect: Effect.Effect<A, E, ArchiveViewServices>) =>
    Effect.runPromiseWith(archiveViewContext)(Effect.withTracerEnabled(effect, false));
  const treeChangedEmitter = yield* acquireScopedDisposable(() => new EventEmitter<string | undefined>());
  const archiveTreeView = yield* acquireScopedDisposable(() =>
    window.createTreeView<string>(ARCHIVE_VIEW.ID, {
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

// A session's own change redraws its row. Anything else redraws the whole tree: a project's row comes and goes with its
// archived sessions, so archiving or unarchiving one can add or drop a project.
const redrawChangedNodes = Effect.fn("ArchiveView.redrawChangedNodes")(function* (
  treeChangedEmitter: EventEmitter<string | undefined>,
  sessionListChange: SessionListChangeDto
) {
  const changedNodeId = yield* Match.valueTags(sessionListChange, {
    ProjectListChanged: () => Effect.undefined,
    ProjectSessionsChanged: () => Effect.undefined,
    SessionChanged: ({sessionId}) => makeSessionNodeId(sessionId)
  });

  yield* Effect.sync(() => {
    treeChangedEmitter.fire(changedNodeId);
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

// Registers the Archive tree for the lifetime of the runtime; disposing the runtime unregisters it.
const makeArchiveView = Effect.fn("ArchiveView.make")(function* () {
  const {archiveTreeView, treeChangedEmitter} = yield* registerTreeView();
  const sessionListChanges = yield* watchSessionListChangesForArchiveView();
  yield* updateWaitingCount(archiveTreeView);

  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      Effect.andThen(redrawChangedNodes(treeChangedEmitter, sessionListChange), updateWaitingCount(archiveTreeView))
    )
  );
});

export const ArchiveView = Layer.effectDiscard(makeArchiveView());
