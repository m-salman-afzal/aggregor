import {
  getProjectListItemForSessionsView,
  listProjectsForSessionsView,
  moveProjectToPlaceOfForSessionsView
} from "@controllers/project.controller.ts";
import {
  findViewedSessionIdForSessionsView,
  getSessionListItemForSessionsView,
  listProjectSessionIdsForSessionsView,
  listSessionsWaitingOnUserForSessionsView,
  listWorkingSessionIdsForSessionsView,
  moveSessionToPlaceOfForSessionsView,
  watchSessionListChangesForSessionsView,
  watchViewedSessionIdsForSessionsView
} from "@controllers/session.controller.ts";
import {
  SELECT_ROW_RETRY,
  SESSION_BADGE_URI_SCHEME,
  SESSIONS_VIEW,
  SPINNER_FRAME_INTERVAL_MS,
  STATUS_LABELS,
  VIEW_BADGE_LABELS
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
import {Array, Effect, Layer, Match, Schedule, Schema, Stream, String} from "effect";

import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {DataTransfer, EventEmitter, TreeView, Uri} from "vscode";

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
// since reveal would open it, while no session's tab is in front, for a session removed while its tab closes, and for
// an archived one, whose row is in the Archive view.
const selectViewedSession = Effect.fn("SessionsView.selectViewedSession")(
  function* (sessionsTreeView: TreeView<string>) {
    if (!sessionsTreeView.visible) return;
    const viewedSessionId = yield* findViewedSessionIdForSessionsView();
    const sessionNodeId = yield* makeSessionNodeId(viewedSessionId);
    const {selection} = sessionsTreeView;
    if (selection.length === 1 && selection[0] === sessionNodeId) return;
    const viewedSessionListItem = yield* getSessionListItemForSessionsView(viewedSessionId);
    if (viewedSessionListItem.isArchived) return;

    yield* Effect.retry(revealRow(sessionsTreeView, sessionNodeId), {
      schedule: Schedule.spaced(SELECT_ROW_RETRY.INTERVAL_MS),
      times: SELECT_ROW_RETRY.TIMES
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

    return Match.valueTags(selectedNode, {ProjectNode: () => false, SessionNode: () => true});
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

    return yield* Match.valueTags(parentNode, {
      ProjectNode: ({projectPath}) =>
        Effect.flatMap(listProjectSessionIdsForSessionsView(projectPath), (sessionIds) =>
          Effect.forEach(sessionIds, (sessionId) => makeSessionNodeId(sessionId))
        ),
      SessionNode: () => Effect.succeed([])
    });
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

    return yield* Match.valueTags(node, {
      ProjectNode: ({projectPath}) =>
        Effect.flatMap(getProjectListItemForSessionsView(projectPath), (projectListItem) =>
          createProjectTreeItem(projectListItem)
        ),
      SessionNode: ({sessionId}) =>
        Effect.flatMap(getSessionListItemForSessionsView(sessionId), (sessionListItem) =>
          createSessionTreeItem(sessionListItem)
        )
    });
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

    return yield* Match.valueTags(node, {
      ProjectNode: () => Effect.undefined,
      SessionNode: ({sessionId}) =>
        Effect.flatMap(getSessionListItemForSessionsView(sessionId), (sessionListItem) =>
          makeProjectNodeId(sessionListItem.projectPath)
        )
    });
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

// VS Code hands the item a drag sets under the tree's own type to a drop on a row of the same tree.
const keepDraggedNodeId = Effect.fn("SessionsView.keepDraggedNodeId", {root: true})(function* (
  draggedNodeIds: readonly string[],
  draggedRows: DataTransfer
) {
  const {DataTransferItem} = yield* VsCodeApi;
  const [draggedNodeId] = draggedNodeIds;
  if (draggedNodeId === undefined) return;

  yield* Effect.sync(() => {
    draggedRows.set(SESSIONS_VIEW.DRAG_MIME_TYPE, new DataTransferItem(draggedNodeId));
  });
});

// A row dropped on another row of its kind takes that row's place; the services keep each row among its own project's
// sessions or the added projects. Any other drop does nothing, and a failure is logged.
const moveDroppedRow = Effect.fn("SessionsView.moveDroppedRow", {root: true})(
  function* (targetNodeId: string | undefined, draggedRows: DataTransfer) {
    const draggedRowItem = draggedRows.get(SESSIONS_VIEW.DRAG_MIME_TYPE);
    if (targetNodeId === undefined || draggedRowItem === undefined) return;
    const draggedNodeId = yield* Effect.promise(() => draggedRowItem.asString());
    const draggedNode = yield* readSessionsTreeNodeId(draggedNodeId);
    const targetNode = yield* readSessionsTreeNodeId(targetNodeId);

    yield* Match.value({draggedNode, targetNode}).pipe(
      Match.when({draggedNode: {_tag: "SessionNode"}, targetNode: {_tag: "SessionNode"}}, (sessionDrop) =>
        moveSessionToPlaceOfForSessionsView(sessionDrop.draggedNode.sessionId, sessionDrop.targetNode.sessionId)
      ),
      Match.when({draggedNode: {_tag: "ProjectNode"}, targetNode: {_tag: "ProjectNode"}}, (projectDrop) =>
        moveProjectToPlaceOfForSessionsView(projectDrop.draggedNode.projectPath, projectDrop.targetNode.projectPath)
      ),
      Match.orElse(() => Effect.void)
    );
  },
  Effect.catch((moveError) => Effect.logWarning("Could not move the dropped row in the Sessions view", moveError))
);

// What the tree, drag and drop, and badge callbacks need to run.
type SessionsViewServices =
  | Effect.Services<
      ReturnType<
        | typeof createNodeTreeItem
        | typeof createSessionBadge
        | typeof findParentNodeId
        | typeof keepDraggedNodeId
        | typeof listChildNodeIds
        | typeof moveDroppedRow
      >
    >
  | VsCodeApi;

type RunPromise = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => Promise<A>;

// VS Code calls the tree and badge callbacks for every row on every redraw and spinner frame, so they run untraced; a
// drag and its drop are one user action each, so they are traced.
interface SessionsViewRunners {
  readonly runPromise: RunPromise;
  readonly runPromiseUntraced: RunPromise;
}

const makeCallbackRunners = Effect.fn("SessionsView.makeCallbackRunners")(function* () {
  const sessionsViewContext = yield* Effect.context<SessionsViewServices>();
  const runPromise = Effect.runPromiseWith(sessionsViewContext);
  const sessionsViewRunners: SessionsViewRunners = {
    runPromise,
    runPromiseUntraced: (effect) => runPromise(Effect.withTracerEnabled(effect, false))
  };

  return sessionsViewRunners;
});

// Each session row's status badge is a file decoration on its URI.
const registerStatusBadges = Effect.fn("SessionsView.registerStatusBadges")(function* (runPromiseUntraced: RunPromise) {
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

const registerTreeView = Effect.fn("SessionsView.registerTreeView")(function* ({
  runPromise,
  runPromiseUntraced
}: SessionsViewRunners) {
  const {EventEmitter, window} = yield* VsCodeApi;
  const treeChangedEmitter = yield* acquireScopedDisposable(() => new EventEmitter<string | undefined>());
  const sessionsTreeView = yield* acquireScopedDisposable(() =>
    window.createTreeView<string>(SESSIONS_VIEW.ID, {
      dragAndDropController: {
        dragMimeTypes: [],
        dropMimeTypes: [SESSIONS_VIEW.DRAG_MIME_TYPE],
        handleDrag: (draggedNodeIds, draggedRows) => runPromise(keepDraggedNodeId(draggedNodeIds, draggedRows)),
        handleDrop: (targetNodeId, draggedRows) => runPromise(moveDroppedRow(targetNodeId, draggedRows))
      },
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
  const changedBadgeUris = yield* Match.valueTags(sessionListChange, {
    ProjectListChanged: () => Effect.succeed([]),
    ProjectSessionsChanged: () => Effect.succeed([]),
    SessionChanged: ({sessionId}) => Effect.map(getSessionBadgeUri(sessionId), (sessionBadgeUri) => [sessionBadgeUri])
  });

  yield* Effect.sync(() => {
    sessionsViewHandles.treeChangedEmitter.fire(changedNodeId);
    if (changedBadgeUris.length > 0) sessionsViewHandles.badgesChangedEmitter.fire(changedBadgeUris);
  });
});

// The view's badge counts the sessions waiting on the user, and VS Code shows it on the activity bar too. A failed read
// leaves the badge as it was.
const updateViewBadge = Effect.fn("SessionsView.updateViewBadge")(
  function* (sessionsTreeView: TreeView<string>) {
    const sessionsWaitingOnUser = yield* listSessionsWaitingOnUserForSessionsView();
    const tooltipLines = Array.map(sessionsWaitingOnUser, ({displayName, status}) =>
      VIEW_BADGE_LABELS.TOOLTIP_LINE(displayName, STATUS_LABELS[status])
    );

    yield* Effect.sync(() => {
      sessionsTreeView.badge =
        tooltipLines.length === 0 ? undefined : {tooltip: Array.join(tooltipLines, "\n"), value: tooltipLines.length};
    });
  },
  (effect) => Effect.ignore(effect)
);

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
  const sessionsViewRunners = yield* makeCallbackRunners();
  const sessionsViewHandles: SessionsViewHandles = {
    badgesChangedEmitter: yield* registerStatusBadges(sessionsViewRunners.runPromiseUntraced),
    ...(yield* registerTreeView(sessionsViewRunners))
  };
  const sessionListChanges = yield* watchSessionListChangesForSessionsView();
  yield* updateViewBadge(sessionsViewHandles.sessionsTreeView);
  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      Effect.andThen(
        redrawChangedNodes(sessionsViewHandles, sessionListChange),
        updateViewBadge(sessionsViewHandles.sessionsTreeView)
      )
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
