import {getUnreadSessionIds} from "@domainServices/session.domainService.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {acquireDisposable, fromEvent} from "@infraUtils/vscode.utils.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {SESSION_URI_SCHEME, SPINNER_INTERVAL_MS, VIEWS} from "@pkg/constants/src/extension.constant.ts";
import {findSession, listSessions} from "@services/session.service.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";
import {
  createProjectTreeItem,
  createSessionTreeItem,
  createStatusBadge,
  getChildRows,
  getParentRow,
  getRowStatus,
  getSessionRowUri
} from "@views/sessions/sessions.utils.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Array, Effect, Layer, Ref, Result, Schedule, Schema, Stream, String, SubscriptionRef} from "effect";

import type {IHarnessInfraServices} from "@interfaces/harness.infraService.interface.ts";
import type {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";
import type {Row, RowStatus} from "@views/sessions/sessions.view.type.ts";
import type {Path} from "effect/Path";
import type {EventEmitter, TreeView, Uri} from "vscode";

// The status each row was last drawn with, by session id.
type DrawnRowStatus = (sessionId: EntityIdValueObject) => RowStatus | undefined;

// VS Code calls the tree and badge callbacks for every row on every refresh and spinner frame, so they run untraced.
type RunSyncUntraced = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => A;

// What the view's functions share: the tree and its change events, and the statuses its rows were drawn from.
interface SessionsViewParts {
  readonly badgesChangedEmitter: EventEmitter<Uri[]>;
  readonly drawnRowStatuses: Ref.Ref<ReadonlyMap<EntityIdValueObject, RowStatus | undefined>>;
  readonly previousSessionStatuses: Ref.Ref<ReadonlyMap<EntityIdValueObject, StatusValueObject>>;
  readonly sessionsTreeView: TreeView<Row>;
  readonly treeChangedEmitter: EventEmitter<void>;
  readonly unreadSessionIds: Ref.Ref<ReadonlySet<EntityIdValueObject>>;
}

type SessionsViewServices =
  | IHarnessInfraServices
  | IProjectRepository
  | ISessionRepository
  | ITerminalInfraService
  | IWorkspaceInfraService
  | Path
  | VsCodeApi;

class RevealFailedError extends Schema.TaggedError<RevealFailedError, {readonly brand: unique symbol}>()(
  "RevealFailedError",
  {cause: Schema.Unknown}
) {}

// Selects the session whose tab became active. Skipped while the view is hidden, since reveal would open it.
const revealSession = Effect.fn("SessionsView.revealSession")(
  function* (sessionsTreeView: TreeView<Row>, sessionId: EntityIdValueObject) {
    const session = yield* findSession(sessionId);
    if (!sessionsTreeView.visible) return;

    yield* Effect.tryPromise({
      catch: (cause) => RevealFailedError.make({cause}),
      try: () => sessionsTreeView.reveal(session, {focus: false, select: true})
    });
  },
  Effect.ignore({log: "Warn", message: "Could not select the active session in the Sessions view"})
);

const makeUntracedRunner = Effect.fn("SessionsView.makeUntracedRunner")(function* () {
  const sessionsViewContext = yield* Effect.context<SessionsViewServices>();
  const runSync = Effect.runSyncWith(sessionsViewContext);
  const runSyncUntraced: RunSyncUntraced = (effect) => runSync(Effect.withTracerEnabled(effect, false));

  return runSyncUntraced;
});

// Each session row's status badge is a file decoration on its URI.
const registerStatusBadges = Effect.fn("SessionsView.registerStatusBadges")(function* (
  getDrawnRowStatus: DrawnRowStatus,
  runSyncUntraced: RunSyncUntraced
) {
  const {EventEmitter, window} = yield* VsCodeApi;
  const badgesChangedEmitter = yield* acquireDisposable(() => new EventEmitter<Uri[]>());
  yield* acquireDisposable(() =>
    window.registerFileDecorationProvider({
      onDidChangeFileDecorations: badgesChangedEmitter.event,
      // VS Code asks about every file it shows, so anything not ours returns before running an effect.
      provideFileDecoration: (uri) =>
        uri.scheme === SESSION_URI_SCHEME
          ? Result.match(decodeEntityId(String.slice(1)(uri.path)), {
              onFailure: () => undefined,
              onSuccess: (sessionId) => runSyncUntraced(createStatusBadge(getDrawnRowStatus(sessionId)))
            })
          : undefined
    })
  );

  return badgesChangedEmitter;
});

const registerTreeView = Effect.fn("SessionsView.registerTreeView")(function* (
  getDrawnRowStatus: DrawnRowStatus,
  runSyncUntraced: RunSyncUntraced
) {
  const {EventEmitter, window} = yield* VsCodeApi;
  const treeChangedEmitter = yield* acquireDisposable(() => new EventEmitter<void>());
  const sessionsTreeView = yield* acquireDisposable(() =>
    window.createTreeView<Row>(VIEWS.SESSIONS, {
      treeDataProvider: {
        getChildren: (parentRow) => [...runSyncUntraced(getChildRows(parentRow))],
        getParent: (row) => runSyncUntraced(getParentRow(row)),
        getTreeItem: (row) =>
          Schema.is(ListedProjectValueObject)(row)
            ? runSyncUntraced(createProjectTreeItem(row))
            : runSyncUntraced(createSessionTreeItem(row, getDrawnRowStatus(row.id))),
        onDidChangeTreeData: treeChangedEmitter.event
      }
    })
  );

  return {sessionsTreeView, treeChangedEmitter};
});

const getAllSessionStatuses = Effect.fn("SessionsView.getAllSessionStatuses")(function* () {
  const allSessions = yield* listSessions();
  const allSessionStatuses: ReadonlyMap<EntityIdValueObject, StatusValueObject> = new Map(
    Array.map(allSessions, (session) => [session.id, session.status] as const)
  );

  return allSessionStatuses;
});

// Compares the statuses with the previous look; the rule itself is SessionDomainService's.
const updateUnreadSessionIds = Effect.fn("SessionsView.updateUnreadSessionIds")(function* (
  viewParts: SessionsViewParts
) {
  const {viewedSessionId} = yield* ITerminalInfraService;
  const currentStatuses = yield* getAllSessionStatuses();
  const previousStatuses = yield* Ref.getAndSet(viewParts.previousSessionStatuses, currentStatuses);
  const viewedSessionIdResult = yield* SubscriptionRef.get(viewedSessionId);
  const currentViewedSessionId = Result.getOrUndefined(viewedSessionIdResult);

  const previousUnreadSessionIds = yield* Ref.get(viewParts.unreadSessionIds);
  const currentUnreadSessionIds = yield* getUnreadSessionIds({
    currentStatuses,
    previousStatuses,
    previousUnreadSessionIds,
    viewedSessionId: currentViewedSessionId
  });
  yield* Ref.set(viewParts.unreadSessionIds, currentUnreadSessionIds);

  return currentUnreadSessionIds;
});

const getChangedBadgeUris = Effect.fn("SessionsView.getChangedBadgeUris")(function* (
  viewParts: SessionsViewParts,
  currentUnreadSessionIds: ReadonlySet<EntityIdValueObject>
) {
  const allSessions = yield* listSessions();
  const currentRowStatusEntries = yield* Effect.forEach(allSessions, (session) =>
    Effect.map(getRowStatus(session, currentUnreadSessionIds), (rowStatus) => [session.id, rowStatus] as const)
  );
  const currentRowStatuses = new Map(currentRowStatusEntries);
  const previousRowStatuses = yield* Ref.getAndSet(viewParts.drawnRowStatuses, currentRowStatuses);
  const changedRowStatuses = Array.filter(
    [...currentRowStatuses],
    ([sessionId, rowStatus]) => !previousRowStatuses.has(sessionId) || previousRowStatuses.get(sessionId) !== rowStatus
  );

  return yield* Effect.forEach(changedRowStatuses, ([sessionId]) => getSessionRowUri(sessionId));
});

const refreshSessionsTree = Effect.fn("SessionsView.refreshSessionsTree")(function* (viewParts: SessionsViewParts) {
  const currentUnreadSessionIds = yield* updateUnreadSessionIds(viewParts);
  const changedBadgeUris = yield* getChangedBadgeUris(viewParts, currentUnreadSessionIds);

  yield* Effect.sync(() => {
    viewParts.treeChangedEmitter.fire();
    if (changedBadgeUris.length > 0) viewParts.badgesChangedEmitter.fire(changedBadgeUris);
  });
});

// ponytail: ticks for the view's whole life and returns at once when it is hidden or nothing works. Start and stop it
// on status changes if the idle wake-ups ever show up in a profile.
const advanceSpinnerFrames = Effect.fn("SessionsView.advanceSpinnerFrames")(function* (viewParts: SessionsViewParts) {
  const drawnRowStatuses = yield* Ref.get(viewParts.drawnRowStatuses);
  const workingRows = Array.filter([...drawnRowStatuses], ([, rowStatus]) => rowStatus === "working");
  if (!viewParts.sessionsTreeView.visible || workingRows.length === 0) return;

  const workingBadgeUris = yield* Effect.forEach(workingRows, ([sessionId]) => getSessionRowUri(sessionId));
  yield* Effect.sync(() => {
    viewParts.badgesChangedEmitter.fire(workingBadgeUris);
  });
});

// Rows change when a project or workspace folder is added or removed, when a session is added, removed or renamed or its
// status changes, when its tab opens or closes, and when it comes into view, which marks it read.
const watchRowChanges = Effect.fn("SessionsView.watchRowChanges")(function* () {
  const {workspace} = yield* VsCodeApi;
  const rowChangeSources: readonly Stream.Stream<unknown>[] = [
    SubscriptionRef.changes((yield* IProjectRepository).addedProjectPaths),
    yield* fromEvent(workspace.onDidChangeWorkspaceFolders),
    SubscriptionRef.changes((yield* ISessionRepository).sessions),
    (yield* ITerminalInfraService).openSessionIds,
    SubscriptionRef.changes((yield* ITerminalInfraService).viewedSessionId)
  ];

  return Stream.mergeAll(rowChangeSources, {concurrency: "unbounded"});
});

const makeSessionsViewParts = Effect.fn("SessionsView.makeSessionsViewParts")(function* () {
  const runSyncUntraced = yield* makeUntracedRunner();
  const drawnRowStatuses = yield* Ref.make<ReadonlyMap<EntityIdValueObject, RowStatus | undefined>>(new Map());
  const getDrawnRowStatus: DrawnRowStatus = (sessionId) => runSyncUntraced(Ref.get(drawnRowStatuses)).get(sessionId);
  const viewParts: SessionsViewParts = {
    badgesChangedEmitter: yield* registerStatusBadges(getDrawnRowStatus, runSyncUntraced),
    drawnRowStatuses,
    previousSessionStatuses: yield* Ref.make<ReadonlyMap<EntityIdValueObject, StatusValueObject>>(new Map()),
    unreadSessionIds: yield* Ref.make<ReadonlySet<EntityIdValueObject>>(new Set()),
    ...(yield* registerTreeView(getDrawnRowStatus, runSyncUntraced))
  };

  return viewParts;
});

// Registers the Sessions tree for the lifetime of the runtime; disposing the runtime unregisters it.
const makeSessionsView = Effect.fn("SessionsView.make")(function* () {
  const {activatedSessionIds} = yield* ITerminalInfraService;
  const viewParts = yield* makeSessionsViewParts();
  const rowChanges = yield* watchRowChanges();
  yield* Effect.forkScoped(Stream.runForEach(rowChanges, () => refreshSessionsTree(viewParts)));
  yield* Effect.forkScoped(
    Effect.withTracerEnabled(
      Effect.repeat(advanceSpinnerFrames(viewParts), Schedule.spaced(SPINNER_INTERVAL_MS)),
      false
    )
  );
  yield* Effect.forkScoped(
    Stream.runForEach(activatedSessionIds, (sessionId) => revealSession(viewParts.sessionsTreeView, sessionId))
  );
});

export const SessionsView = Layer.effectDiscard(makeSessionsView());
