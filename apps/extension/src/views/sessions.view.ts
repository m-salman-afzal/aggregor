import {NoActiveTerminal, RevealFailed} from "@/errors/session.error.ts";
import {RepoStore} from "@/services/repo/repo.service.ts";
import {listRepos} from "@/services/repo/repo.utils.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {findSession, listSessions} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {acquireDisposable, fromEvent, getClaudeIcon} from "@/services/vscode.utils.ts";
import {
  COMMANDS,
  CONTEXT_VALUES,
  REPO_ICON,
  SESSION_URI_SCHEME,
  SPINNER_INTERVAL_MS,
  STATUS_BADGES,
  VIEWS
} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_LABELS, STATUS_LABELS} from "@pkg/constants/src/message.constant.ts";
import {Clock, Effect, Layer, Option, Ref, Result, Schedule, Stream, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {Repo} from "@/services/repo/repo.service.ts";
import type {Status} from "@/services/session/status.service.ts";
import type {Session} from "@/services/session/store.service.ts";
import type {Terminal, TreeView, Uri} from "vscode";

// Repos at the top level, each with the sessions started in it.
type Row = Repo | Session;

// What a row shows. "unread" is an idle session whose last turn ended while it was out of view; undefined is a
// terminal whose hooks have not fired yet.
type RowStatus = "unread" | Status;

type SessionsViewServices =
  Path | RepoStore | SessionStore | StatusService | TerminalService | TranscriptService | VsCodeService;

const isRepo = (row: Row): row is Repo => "added" in row;

// Without a terminal in this window the agent is gone; with one, the hooks say what it is doing.
const getRowStatus = Effect.fn("getRowStatus")(function* (sessionId: string, unreadSessionIds: ReadonlySet<string>) {
  const {isSessionTerminalOpen} = yield* TerminalService;
  if (!(yield* isSessionTerminalOpen(sessionId))) return "exited" satisfies RowStatus;

  const {sessionStatuses} = yield* StatusService;
  const sessionStatus = (yield* SubscriptionRef.get(sessionStatuses)).get(sessionId);

  return sessionStatus === "idle" && unreadSessionIds.has(sessionId) ? ("unread" satisfies RowStatus) : sessionStatus;
});

// The handle the status badge hangs off; the decoration provider reads the session id back from the path.
const getSessionRowUri = Effect.fn("getSessionRowUri")(function* (sessionId: string) {
  const {Uri} = yield* VsCodeService;

  return Uri.from({path: `/${sessionId}`, scheme: SESSION_URI_SCHEME});
});

const createSessionTreeItem = Effect.fn("createSessionTreeItem")(function* (
  session: Session,
  rowStatus: RowStatus | undefined
) {
  const {TreeItem} = yield* VsCodeService;
  const path = yield* Path;
  const statusLabel = rowStatus === undefined ? undefined : STATUS_LABELS[rowStatus];
  const {getSessionTitle} = yield* TranscriptService;
  const claudeTitle = yield* getSessionTitle(session.id);
  const rowLabel = Option.getOrElse(claudeTitle, () => session.name);
  const repoFolderName = path.basename(session.cwd);
  const treeItem = new TreeItem(rowLabel);
  treeItem.id = session.id;
  treeItem.iconPath = yield* getClaudeIcon();
  treeItem.resourceUri = yield* getSessionRowUri(session.id);
  treeItem.tooltip = SESSION_LABELS.TOOLTIP(session.name, session.cwd, statusLabel);
  treeItem.accessibilityInformation = {label: SESSION_LABELS.ACCESSIBLE(rowLabel, repoFolderName, statusLabel)};
  treeItem.contextValue = CONTEXT_VALUES.SESSION;
  treeItem.command = {arguments: [session.id], command: COMMANDS.SESSION_ROW.OPEN, title: SESSION_LABELS.OPEN_SESSION};

  return treeItem;
});

// The id is the path, which never collides with a session's UUID.
const createRepoTreeItem = Effect.fn("createRepoTreeItem")(function* (repo: Repo) {
  const {ThemeIcon, TreeItem, TreeItemCollapsibleState} = yield* VsCodeService;
  const treeItem = new TreeItem(repo.name, TreeItemCollapsibleState.Expanded);
  treeItem.id = repo.path;
  treeItem.iconPath = new ThemeIcon(REPO_ICON);
  treeItem.tooltip = repo.path;
  treeItem.contextValue = repo.added ? CONTEXT_VALUES.ADDED_REPO : CONTEXT_VALUES.REPO;

  return treeItem;
});

const createStatusBadge = Effect.fn("createStatusBadge")(function* (rowStatus: RowStatus | undefined) {
  if (rowStatus === undefined || rowStatus === "idle") return undefined;

  const {FileDecoration, ThemeColor} = yield* VsCodeService;
  const {color, frames} = STATUS_BADGES[rowStatus];
  const frameIndex = Math.floor((yield* Clock.currentTimeMillis) / SPINNER_INTERVAL_MS) % frames.length;

  return new FileDecoration(frames[frameIndex], STATUS_LABELS[rowStatus], new ThemeColor(color));
});

// Every repo is listed, even one without sessions, so adding a repo always shows. A session sits under the repo whose
// path is its cwd; one whose repo is not in this window is not shown here.
const getChildRows = Effect.fn("getChildRows")(function* (parentRow: Row | undefined) {
  if (parentRow === undefined) return yield* listRepos();
  if (!isRepo(parentRow)) return [];

  const allSessions = yield* listSessions();

  return allSessions.filter((session) => session.cwd === parentRow.path);
});

const getParentRow = Effect.fn("getParentRow")(function* (row: Row) {
  if (isRepo(row)) return undefined;

  const repos = yield* listRepos();

  return repos.find((repo) => repo.path === row.cwd);
});

// Selects the session whose tab became active. Skipped while the view is hidden, since reveal would open it.
const revealSession = Effect.fn("revealSession")(function* (
  sessionsTreeView: TreeView<Row>,
  activeTerminal: Terminal | undefined
) {
  const terminal = yield* Effect.fromResult(Result.fromNullishOr(activeTerminal, () => new NoActiveTerminal()));
  const sessionId = yield* TerminalService.use((terminalService) => terminalService.findTerminalSessionId(terminal));
  const session = yield* findSession(sessionId);
  if (!sessionsTreeView.visible) return;

  yield* Effect.tryPromise({
    catch: (cause) => new RevealFailed({cause}),
    try: async () => sessionsTreeView.reveal(session, {focus: false, select: true})
  });
});

// Registers the Sessions tree for the lifetime of the runtime; disposing the runtime unregisters it.
export const SessionsView = Layer.effectDiscard(
  Effect.gen(function* () {
    const {EventEmitter, window, workspace} = yield* VsCodeService;
    const {addedRepoPaths} = yield* RepoStore;
    const {sessions} = yield* SessionStore;
    const {sessionTerminals, viewedSessionId} = yield* TerminalService;
    const {sessionTitles} = yield* TranscriptService;
    const {sessionStatuses} = yield* StatusService;
    const runSync = Effect.runSyncWith(yield* Effect.context<SessionsViewServices>());
    // VS Code calls the tree and badge callbacks for every row on every refresh and spinner frame, so they run untraced.
    const runSyncUntraced = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) =>
      runSync(Effect.withTracerEnabled(effect, false));

    // What each row was last drawn with; the tree and the badges both render from it. Only rows whose status moved are
    // named in the badge change event: one without URIs makes VS Code drop every cached badge, and all rows flash
    // plain until it fetches them again.
    const drawnRowStatuses = yield* Ref.make<ReadonlyMap<string, RowStatus | undefined>>(new Map());
    const getDrawnRowStatus = (sessionId: string) => runSync(Ref.get(drawnRowStatuses)).get(sessionId);
    const unreadSessionIds = yield* Ref.make<ReadonlySet<string>>(new Set());
    const previousSessionStatuses = yield* Ref.make<ReadonlyMap<string, Status>>(new Map());

    const treeChangedEmitter = yield* acquireDisposable(() => new EventEmitter<void>());
    const badgesChangedEmitter = yield* acquireDisposable(() => new EventEmitter<Uri[]>());
    yield* acquireDisposable(() =>
      window.registerFileDecorationProvider({
        onDidChangeFileDecorations: badgesChangedEmitter.event,
        // VS Code asks about every file it shows, so anything not ours returns before running an effect.
        provideFileDecoration: (uri) =>
          uri.scheme === SESSION_URI_SCHEME
            ? runSyncUntraced(createStatusBadge(getDrawnRowStatus(uri.path.slice(1))))
            : undefined
      })
    );
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

    // A turn that ends while its session is out of view leaves it unread until it comes into view or starts another
    // turn. Ended means idle now, and running or waiting on the user at the previous look.
    const updateUnreadSessionIds = Effect.fn("SessionsView.updateUnreadSessionIds")(function* () {
      const currentStatuses = yield* SubscriptionRef.get(sessionStatuses);
      const previousStatuses = yield* Ref.getAndSet(previousSessionStatuses, currentStatuses);
      const currentViewedSessionId = Option.getOrUndefined(yield* SubscriptionRef.get(viewedSessionId));
      const endedSessionIds = [...currentStatuses]
        .filter(
          ([sessionId, sessionStatus]) =>
            sessionStatus === "idle" && ["needs-input", "running"].includes(previousStatuses.get(sessionId) ?? "")
        )
        .map(([sessionId]) => sessionId);

      const isIdleAndOutOfView = (sessionId: string) =>
        currentStatuses.get(sessionId) === "idle" && sessionId !== currentViewedSessionId;

      return yield* Ref.updateAndGet(
        unreadSessionIds,
        (previousUnreadSessionIds) =>
          new Set([...previousUnreadSessionIds, ...endedSessionIds].filter(isIdleAndOutOfView))
      );
    });

    const getChangedBadgeUris = Effect.fn("SessionsView.getChangedBadgeUris")(function* (
      currentUnreadSessionIds: ReadonlySet<string>
    ) {
      const allSessions = yield* listSessions();
      const currentRowStatuses = new Map(
        yield* Effect.forEach(allSessions, (session) =>
          Effect.map(getRowStatus(session.id, currentUnreadSessionIds), (rowStatus) => [session.id, rowStatus] as const)
        )
      );
      const previousRowStatuses = yield* Ref.getAndSet(drawnRowStatuses, currentRowStatuses);
      const changedRowStatuses = [...currentRowStatuses].filter(
        ([sessionId, rowStatus]) =>
          !previousRowStatuses.has(sessionId) || previousRowStatuses.get(sessionId) !== rowStatus
      );

      return yield* Effect.forEach(changedRowStatuses, ([sessionId]) => getSessionRowUri(sessionId));
    });

    const refreshSessionsTree = Effect.fn("SessionsView.refreshSessionsTree")(function* () {
      const changedBadgeUris = yield* getChangedBadgeUris(yield* updateUnreadSessionIds());

      yield* Effect.sync(() => {
        treeChangedEmitter.fire();
        if (changedBadgeUris.length > 0) badgesChangedEmitter.fire(changedBadgeUris);
      });
    });

    // ponytail: ticks for the view's whole life and returns at once when it is hidden or nothing runs. Start and stop
    // it on status changes if the idle wake-ups ever show up in a profile.
    const advanceSpinnerFrames = Effect.fn("SessionsView.advanceSpinnerFrames")(function* () {
      const runningRows = [...(yield* Ref.get(drawnRowStatuses))].filter(([, rowStatus]) => rowStatus === "running");
      if (!sessionsTreeView.visible || runningRows.length === 0) return;

      const runningBadgeUris = yield* Effect.forEach(runningRows, ([sessionId]) => getSessionRowUri(sessionId));
      yield* Effect.sync(() => {
        badgesChangedEmitter.fire(runningBadgeUris);
      });
    });

    // Rows change when a repo or workspace folder is added or removed, when a session is added or removed, when its tab
    // opens or closes, when Claude renames it, when its status changes, and when it comes into view, which marks it read.
    const rowChangeSources: readonly Stream.Stream<unknown>[] = [
      SubscriptionRef.changes(addedRepoPaths),
      fromEvent(workspace.onDidChangeWorkspaceFolders),
      SubscriptionRef.changes(sessions),
      SubscriptionRef.changes(sessionTerminals),
      SubscriptionRef.changes(sessionTitles),
      SubscriptionRef.changes(sessionStatuses),
      SubscriptionRef.changes(viewedSessionId)
    ];
    const rowChanges = Stream.mergeAll(rowChangeSources, {concurrency: "unbounded"});
    yield* Effect.forkScoped(Stream.runForEach(rowChanges, () => refreshSessionsTree()));
    yield* Effect.forkScoped(
      Effect.repeat(advanceSpinnerFrames(), Schedule.spaced(SPINNER_INTERVAL_MS)).pipe(Effect.withTracerEnabled(false))
    );
    yield* Effect.forkScoped(
      Stream.runForEach(fromEvent(window.onDidChangeActiveTerminal), (activeTerminal) =>
        revealSession(sessionsTreeView, activeTerminal).pipe(
          // No active terminal, or one that is not a session's: nothing to select.
          Effect.catchTag(["NoActiveTerminal", "UntrackedTerminal"], () => Effect.void),
          Effect.ignore({log: "Warn", message: "Could not select the active session in the Sessions view"})
        )
      )
    );
  })
);
