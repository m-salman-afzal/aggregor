import {IHarnessInfraService} from "@/application/interfaces/harness.infraService.interface.ts";
import {ITerminalInfraService} from "@/application/interfaces/terminal.infraService.interface.ts";
import {findSession, listSessions} from "@/application/services/session.service.ts";
import {forEachHarnessInfraService} from "@/application/utils/harness.utils.ts";
import {IProjectRepository} from "@/domain/entities/project/project.repository.interface.ts";
import {getUnreadSessionIds} from "@/domain/entities/session/session.entity.ts";
import {ISessionRepository} from "@/domain/entities/session/session.repository.interface.ts";
import {decodeSessionId} from "@/domain/valueObjects/sessionId.valueObject.ts";
import {acquireDisposable, fromEvent} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {
  createProjectTreeItem,
  createSessionTreeItem,
  createStatusBadge,
  getChildRows,
  getParentRow,
  getRowStatus,
  getSessionRowUri,
  isProject
} from "@/presentation/views/sessions/sessions.utils.ts";
import {SESSION_URI_SCHEME, SPINNER_INTERVAL_MS, VIEWS} from "@pkg/constants/src/extension.constant.ts";
import {Data, Effect, Layer, Ref, Result, Schedule, Stream, SubscriptionRef} from "effect";

import type {IHarnessInfraServices} from "@/application/interfaces/harness.infraService.interface.ts";
import type {IWorkspaceInfraService} from "@/application/interfaces/workspace.infraService.interface.ts";
import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@/domain/valueObjects/status.valueObject.ts";
import type {Row, RowStatus} from "@/presentation/views/sessions/sessions.view.type.ts";
import type {Path} from "effect/Path";
import type {EventEmitter, TreeView, Uri} from "vscode";

// The status each row was last drawn with, by session id.
type DrawnRowStatus = (sessionId: SessionIdValueObject) => RowStatus | undefined;

// VS Code calls the tree and badge callbacks for every row on every refresh and spinner frame, so they run untraced.
type RunSyncUntraced = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => A;

// What the view's functions share: the tree and its change events, and the statuses its rows were drawn from.
interface SessionsViewParts {
  readonly badgesChangedEmitter: EventEmitter<Uri[]>;
  readonly drawnRowStatuses: Ref.Ref<ReadonlyMap<SessionIdValueObject, RowStatus | undefined>>;
  readonly previousSessionStatuses: Ref.Ref<ReadonlyMap<SessionIdValueObject, StatusValueObject>>;
  readonly sessionsTreeView: TreeView<Row>;
  readonly treeChangedEmitter: EventEmitter<void>;
  readonly unreadSessionIds: Ref.Ref<ReadonlySet<SessionIdValueObject>>;
}

type SessionsViewServices =
  | IHarnessInfraServices
  | IProjectRepository
  | ISessionRepository
  | ITerminalInfraService
  | IWorkspaceInfraService
  | Path
  | VsCodeApi;

class RevealFailedError extends Data.TaggedError("RevealFailedError")<{readonly cause: unknown}> {}

// Selects the session whose tab became active. Skipped while the view is hidden, since reveal would open it.
const revealSession = Effect.fn("SessionsView.revealSession")(
  function* (sessionsTreeView: TreeView<Row>, sessionId: SessionIdValueObject) {
    const session = yield* findSession(sessionId);
    if (!sessionsTreeView.visible) return;

    yield* Effect.tryPromise({
      catch: (cause) => new RevealFailedError({cause}),
      try: async () => sessionsTreeView.reveal(session, {focus: false, select: true})
    });
  },
  Effect.ignore({log: "Warn", message: "Could not select the active session in the Sessions view"})
);

const makeUntracedRunner = Effect.fn("SessionsView.makeUntracedRunner")(function* () {
  const runSync = Effect.runSyncWith(yield* Effect.context<SessionsViewServices>());
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
          ? Result.match(decodeSessionId(uri.path.slice(1)), {
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
          isProject(row)
            ? runSyncUntraced(createProjectTreeItem(row))
            : runSyncUntraced(createSessionTreeItem(row, getDrawnRowStatus(row.id))),
        onDidChangeTreeData: treeChangedEmitter.event
      }
    })
  );

  return {sessionsTreeView, treeChangedEmitter};
});

// Every harness's statuses in one map; session ids are unique across harnesses.
const getAllSessionStatuses = Effect.fn("SessionsView.getAllSessionStatuses")(function* () {
  const statusesByHarness = yield* forEachHarnessInfraService(
    IHarnessInfraService.use((harnessInfraService) => SubscriptionRef.get(harnessInfraService.sessionStatuses))
  );
  const allSessionStatuses: ReadonlyMap<SessionIdValueObject, StatusValueObject> = new Map(
    statusesByHarness.flatMap((sessionStatuses) => [...sessionStatuses])
  );

  return allSessionStatuses;
});

// Compares the statuses with the previous look; the rule itself is the entity's.
const updateUnreadSessionIds = Effect.fn("SessionsView.updateUnreadSessionIds")(function* (
  viewParts: SessionsViewParts
) {
  const {viewedSessionId} = yield* ITerminalInfraService;
  const currentStatuses = yield* getAllSessionStatuses();
  const previousStatuses = yield* Ref.getAndSet(viewParts.previousSessionStatuses, currentStatuses);
  const currentViewedSessionId = Result.getOrUndefined(yield* SubscriptionRef.get(viewedSessionId));

  return yield* Ref.updateAndGet(viewParts.unreadSessionIds, (previousUnreadSessionIds) =>
    getUnreadSessionIds({
      currentStatuses,
      previousStatuses,
      previousUnreadSessionIds,
      viewedSessionId: currentViewedSessionId
    })
  );
});

const getChangedBadgeUris = Effect.fn("SessionsView.getChangedBadgeUris")(function* (
  viewParts: SessionsViewParts,
  currentUnreadSessionIds: ReadonlySet<SessionIdValueObject>
) {
  const allSessions = yield* listSessions();
  const currentRowStatuses = new Map(
    yield* Effect.forEach(allSessions, (session) =>
      Effect.map(getRowStatus(session, currentUnreadSessionIds), (rowStatus) => [session.id, rowStatus] as const)
    )
  );
  const previousRowStatuses = yield* Ref.getAndSet(viewParts.drawnRowStatuses, currentRowStatuses);
  const changedRowStatuses = [...currentRowStatuses].filter(
    ([sessionId, rowStatus]) => !previousRowStatuses.has(sessionId) || previousRowStatuses.get(sessionId) !== rowStatus
  );

  return yield* Effect.forEach(changedRowStatuses, ([sessionId]) => getSessionRowUri(sessionId));
});

const refreshSessionsTree = Effect.fn("SessionsView.refreshSessionsTree")(function* (viewParts: SessionsViewParts) {
  const changedBadgeUris = yield* getChangedBadgeUris(viewParts, yield* updateUnreadSessionIds(viewParts));

  yield* Effect.sync(() => {
    viewParts.treeChangedEmitter.fire();
    if (changedBadgeUris.length > 0) viewParts.badgesChangedEmitter.fire(changedBadgeUris);
  });
});

// ponytail: ticks for the view's whole life and returns at once when it is hidden or nothing runs. Start and stop it
// on status changes if the idle wake-ups ever show up in a profile.
const advanceSpinnerFrames = Effect.fn("SessionsView.advanceSpinnerFrames")(function* (viewParts: SessionsViewParts) {
  const drawnRowStatuses = yield* Ref.get(viewParts.drawnRowStatuses);
  const runningRows = [...drawnRowStatuses].filter(([, rowStatus]) => rowStatus === "running");
  if (!viewParts.sessionsTreeView.visible || runningRows.length === 0) return;

  const runningBadgeUris = yield* Effect.forEach(runningRows, ([sessionId]) => getSessionRowUri(sessionId));
  yield* Effect.sync(() => {
    viewParts.badgesChangedEmitter.fire(runningBadgeUris);
  });
});

// Rows change when a project or workspace folder is added or removed, when a session is added or removed, when its tab
// opens or closes, when its agent renames it, when its status changes, and when it comes into view, which marks it read.
const watchRowChanges = Effect.fn("SessionsView.watchRowChanges")(function* () {
  const {workspace} = yield* VsCodeApi;
  const harnessChangeSources = yield* forEachHarnessInfraService(
    IHarnessInfraService.useSync((harnessInfraService): readonly Stream.Stream<unknown>[] => [
      SubscriptionRef.changes(harnessInfraService.sessionTitles),
      SubscriptionRef.changes(harnessInfraService.sessionStatuses)
    ])
  );
  const rowChangeSources: readonly Stream.Stream<unknown>[] = [
    SubscriptionRef.changes((yield* IProjectRepository).addedProjectPaths),
    fromEvent(workspace.onDidChangeWorkspaceFolders),
    SubscriptionRef.changes((yield* ISessionRepository).sessions),
    (yield* ITerminalInfraService).openSessionIds,
    SubscriptionRef.changes((yield* ITerminalInfraService).viewedSessionId),
    ...harnessChangeSources.flat()
  ];

  return Stream.mergeAll(rowChangeSources, {concurrency: "unbounded"});
});

const makeSessionsViewParts = Effect.fn("SessionsView.makeSessionsViewParts")(function* () {
  const runSyncUntraced = yield* makeUntracedRunner();
  const drawnRowStatuses = yield* Ref.make<ReadonlyMap<SessionIdValueObject, RowStatus | undefined>>(new Map());
  const getDrawnRowStatus: DrawnRowStatus = (sessionId) => runSyncUntraced(Ref.get(drawnRowStatuses)).get(sessionId);
  const viewParts: SessionsViewParts = {
    badgesChangedEmitter: yield* registerStatusBadges(getDrawnRowStatus, runSyncUntraced),
    drawnRowStatuses,
    previousSessionStatuses: yield* Ref.make<ReadonlyMap<SessionIdValueObject, StatusValueObject>>(new Map()),
    unreadSessionIds: yield* Ref.make<ReadonlySet<SessionIdValueObject>>(new Set()),
    ...(yield* registerTreeView(getDrawnRowStatus, runSyncUntraced))
  };

  return viewParts;
});

// Registers the Sessions tree for the lifetime of the runtime; disposing the runtime unregisters it.
const makeSessionsView = Effect.fn("SessionsView.make")(function* () {
  const {activatedSessionIds} = yield* ITerminalInfraService;
  const viewParts = yield* makeSessionsViewParts();
  yield* Effect.forkScoped(Stream.runForEach(yield* watchRowChanges(), () => refreshSessionsTree(viewParts)));
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
