import {HarnessClient} from "@/application/clients/harness.client.ts";
import {TerminalClient} from "@/application/clients/terminal.client.ts";
import {findSession, listSessions} from "@/application/session/session.service.ts";
import {forEachHarnessClient} from "@/application/utils/harness.utils.ts";
import {RepoRepository} from "@/domain/entities/repo/repo.repository.ts";
import {getUnreadSessionIds} from "@/domain/entities/session/session.entity.ts";
import {SessionRepository} from "@/domain/entities/session/session.repository.ts";
import {decodeSessionId} from "@/domain/value-objects/session-id.value-object.ts";
import {RevealFailed} from "@/errors/session.error.ts";
import {acquireDisposable, fromEvent} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {
  createRepoTreeItem,
  createSessionTreeItem,
  createStatusBadge,
  getChildRows,
  getParentRow,
  getRowStatus,
  getSessionRowUri,
  isRepo
} from "@/views/sessions.utils.ts";
import {SESSION_URI_SCHEME, SPINNER_INTERVAL_MS, VIEWS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer, Ref, Result, Schedule, Stream, SubscriptionRef} from "effect";

import type {Harnesses} from "@/application/clients/harness.client.ts";
import type {WorkspaceClient} from "@/application/clients/workspace.client.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Status} from "@/domain/value-objects/status.value-object.ts";
import type {Row, RowStatus} from "@/views/sessions.utils.ts";
import type {Path} from "effect/Path";
import type {EventEmitter, TreeView, Uri} from "vscode";

type SessionsViewServices =
  Harnesses | Path | RepoRepository | SessionRepository | TerminalClient | VsCodeService | WorkspaceClient;

// Selects the session whose tab became active. Skipped while the view is hidden, since reveal would open it.
const revealSession = Effect.fn("revealSession")(
  function* (sessionsTreeView: TreeView<Row>, sessionId: SessionId) {
    const session = yield* findSession(sessionId);
    if (!sessionsTreeView.visible) return;

    yield* Effect.tryPromise({
      catch: (cause) => new RevealFailed({cause}),
      try: async () => sessionsTreeView.reveal(session, {focus: false, select: true})
    });
  },
  Effect.ignore({log: "Warn", message: "Could not select the active session in the Sessions view"})
);

// The status each row was last drawn with, by session id.
type DrawnRowStatus = (sessionId: SessionId) => RowStatus | undefined;

// VS Code calls the tree and badge callbacks for every row on every refresh and spinner frame, so they run untraced.
type RunSyncUntraced = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => A;

// What the view's functions share: the tree and its change events, and the statuses its rows were drawn from.
interface SessionsViewParts {
  readonly badgesChangedEmitter: EventEmitter<Uri[]>;
  readonly drawnRowStatuses: Ref.Ref<ReadonlyMap<SessionId, RowStatus | undefined>>;
  readonly previousSessionStatuses: Ref.Ref<ReadonlyMap<SessionId, Status>>;
  readonly sessionsTreeView: TreeView<Row>;
  readonly treeChangedEmitter: EventEmitter<void>;
  readonly unreadSessionIds: Ref.Ref<ReadonlySet<SessionId>>;
}

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
  const {EventEmitter, window} = yield* VsCodeService;
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
  const {EventEmitter, window} = yield* VsCodeService;
  const treeChangedEmitter = yield* acquireDisposable(() => new EventEmitter<void>());
  const sessionsTreeView = yield* acquireDisposable(() =>
    window.createTreeView<Row>(VIEWS.SESSIONS, {
      treeDataProvider: {
        getChildren: (parentRow) => [...runSyncUntraced(getChildRows(parentRow))],
        getParent: (row) => runSyncUntraced(getParentRow(row)),
        getTreeItem: (row) =>
          isRepo(row)
            ? runSyncUntraced(createRepoTreeItem(row))
            : runSyncUntraced(createSessionTreeItem(row, getDrawnRowStatus(row.id))),
        onDidChangeTreeData: treeChangedEmitter.event
      }
    })
  );

  return {sessionsTreeView, treeChangedEmitter};
});

// Every harness's statuses in one map; session ids are unique across harnesses.
const getAllSessionStatuses = Effect.fn("SessionsView.getAllSessionStatuses")(function* () {
  const statusesByHarness = yield* forEachHarnessClient(
    HarnessClient.use((harnessClient) => SubscriptionRef.get(harnessClient.sessionStatuses))
  );
  const allSessionStatuses: ReadonlyMap<SessionId, Status> = new Map(
    statusesByHarness.flatMap((sessionStatuses) => [...sessionStatuses])
  );

  return allSessionStatuses;
});

// Compares the statuses with the previous look; the rule itself is the entity's.
const updateUnreadSessionIds = Effect.fn("SessionsView.updateUnreadSessionIds")(function* (
  viewParts: SessionsViewParts
) {
  const {viewedSessionId} = yield* TerminalClient;
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
  currentUnreadSessionIds: ReadonlySet<SessionId>
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

// Rows change when a repo or workspace folder is added or removed, when a session is added or removed, when its tab
// opens or closes, when its agent renames it, when its status changes, and when it comes into view, which marks it read.
const watchRowChanges = Effect.fn("SessionsView.watchRowChanges")(function* () {
  const {workspace} = yield* VsCodeService;
  const harnessChangeSources = yield* forEachHarnessClient(
    HarnessClient.useSync((harnessClient): readonly Stream.Stream<unknown>[] => [
      SubscriptionRef.changes(harnessClient.sessionTitles),
      SubscriptionRef.changes(harnessClient.sessionStatuses)
    ])
  );
  const rowChangeSources: readonly Stream.Stream<unknown>[] = [
    SubscriptionRef.changes((yield* RepoRepository).addedRepoPaths),
    fromEvent(workspace.onDidChangeWorkspaceFolders),
    SubscriptionRef.changes((yield* SessionRepository).sessions),
    (yield* TerminalClient).openSessionIds,
    SubscriptionRef.changes((yield* TerminalClient).viewedSessionId),
    ...harnessChangeSources.flat()
  ];

  return Stream.mergeAll(rowChangeSources, {concurrency: "unbounded"});
});

const makeSessionsViewParts = Effect.fn("SessionsView.makeSessionsViewParts")(function* () {
  const runSyncUntraced = yield* makeUntracedRunner();
  const drawnRowStatuses = yield* Ref.make<ReadonlyMap<SessionId, RowStatus | undefined>>(new Map());
  const getDrawnRowStatus: DrawnRowStatus = (sessionId) => runSyncUntraced(Ref.get(drawnRowStatuses)).get(sessionId);
  const viewParts: SessionsViewParts = {
    badgesChangedEmitter: yield* registerStatusBadges(getDrawnRowStatus, runSyncUntraced),
    drawnRowStatuses,
    previousSessionStatuses: yield* Ref.make<ReadonlyMap<SessionId, Status>>(new Map()),
    unreadSessionIds: yield* Ref.make<ReadonlySet<SessionId>>(new Set()),
    ...(yield* registerTreeView(getDrawnRowStatus, runSyncUntraced))
  };

  return viewParts;
});

// Registers the Sessions tree for the lifetime of the runtime; disposing the runtime unregisters it.
const registerSessionsView = Effect.fn("registerSessionsView")(function* () {
  const {activatedSessionIds} = yield* TerminalClient;
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

export const SessionsView = Layer.effectDiscard(registerSessionsView());
