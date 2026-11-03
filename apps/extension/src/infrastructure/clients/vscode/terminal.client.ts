import {TerminalClient} from "@/application/clients/terminal.client.ts";
import {
  NoActiveTerminal,
  NotATerminalTab,
  TerminalLaunchFailed,
  TerminalNotFound,
  UntrackedTerminal,
  WindowUnfocused
} from "@/application/errors/terminal.error.ts";
import {fromEvent} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {getClaudeIcon} from "@/services/vscode.utils.ts";
import {STATUS_ENV} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {NoViewedSession, TerminalLaunch} from "@/application/clients/terminal.client.ts";
import type {Session} from "@/domain/entities/session/session.entity.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Terminal, Uri} from "vscode";

// Each session's terminal in this window, keyed by session id.
type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionId, Terminal>>;

// What the terminal functions share: the window's session terminals, VS Code's window and the status hooks.
type TerminalDependencies = {
  readonly claudeIconPath: Uri;
  readonly sessionTerminals: SessionTerminalsReference;
} & Pick<StatusService["Service"], "clearStatusFile" | "getStatusFilePath" | "hooksFilePath"> &
  Pick<VsCodeService["Service"], "TabInputTerminal" | "ViewColumn" | "window">;

const findSessionTerminal = Effect.fn("TerminalClient.findSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionId
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return yield* Effect.fromResult(
    Result.fromNullishOr(openTerminals.get(sessionId), () => new TerminalNotFound({sessionId}))
  );
});

const isSessionTerminalOpen = Effect.fn("TerminalClient.isSessionTerminalOpen")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionId
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return openTerminals.has(sessionId);
});

// ponytail: linear scan, a window holds a handful of sessions
const findTerminalSessionId = Effect.fn("TerminalClient.findTerminalSessionId")(function* (
  sessionTerminals: SessionTerminalsReference,
  terminal: Terminal
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
  const [sessionId] = yield* Effect.fromResult(
    Result.fromNullishOr(
      [...openTerminals].find(([, openTerminal]) => openTerminal === terminal),
      () => new UntrackedTerminal()
    )
  );

  return sessionId;
});

// Every launch carries the status hooks; the env var tells them which file to write.
const launchSessionTerminal = Effect.fn("TerminalClient.launchSessionTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  session: Session,
  terminalLaunch: TerminalLaunch
) {
  const {claudeIconPath, getStatusFilePath, hooksFilePath, ViewColumn, window} = terminalDependencies;
  yield* terminalDependencies.clearStatusFile(session.id);

  return yield* Effect.try({
    catch: (cause) => new TerminalLaunchFailed({cause}),
    try: () =>
      window.createTerminal({
        cwd: session.repoPath,
        env: {[STATUS_ENV]: getStatusFilePath(session.id)},
        iconPath: claudeIconPath,
        isTransient: true,
        location: {viewColumn: ViewColumn.Active},
        name: terminalLaunch.tabName,
        shellArgs: [...terminalLaunch.claudeArguments, "--settings", hooksFilePath],
        shellPath: "claude"
      })
  });
});

const showTerminal = Effect.fn("TerminalClient.showTerminal")(function* (terminal: Terminal) {
  yield* Effect.sync(() => {
    terminal.show();
  });
});

const focusSessionTerminal = Effect.fn("TerminalClient.focusSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionId
) {
  yield* showTerminal(yield* findSessionTerminal(sessionTerminals, sessionId));
});

// Reuses the session's terminal when this window has one. Serialized on the map's permit, so a double-click shows the
// terminal the first click launched.
const openSessionTerminal = Effect.fn("TerminalClient.openSessionTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  session: Session,
  terminalLaunch: TerminalLaunch
) {
  const sessionTerminal = yield* SubscriptionRef.modifyEffect(
    terminalDependencies.sessionTerminals,
    (currentTerminals) => {
      const existingTerminal = currentTerminals.get(session.id);
      if (existingTerminal !== undefined) return Effect.succeed([existingTerminal, currentTerminals] as const);

      return Effect.map(
        launchSessionTerminal(terminalDependencies, session, terminalLaunch),
        (launchedTerminal) => [launchedTerminal, new Map(currentTerminals).set(session.id, launchedTerminal)] as const
      );
    }
  );

  yield* showTerminal(sessionTerminal);
});

// Disposing fires onDidCloseTerminal, which drops the map entry.
const closeSessionTerminal = Effect.fn("TerminalClient.closeSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionId
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);

  yield* Effect.sync(() => {
    sessionTerminal.dispose();
  });
});

const findActiveTerminalSessionId = Effect.fn("TerminalClient.findActiveTerminalSessionId")(function* (
  sessionTerminals: SessionTerminalsReference,
  activeTerminal: Terminal | undefined
) {
  const terminal = yield* Effect.fromResult(Result.fromNullishOr(activeTerminal, () => new NoActiveTerminal()));

  return yield* findTerminalSessionId(sessionTerminals, terminal);
});

// No active terminal, or one that is not a session's, emits nothing.
const watchActivatedSessionIds = ({sessionTerminals, window}: TerminalDependencies) =>
  Stream.filterMapEffect(fromEvent(window.onDidChangeActiveTerminal), (activeTerminal) =>
    Effect.result(findActiveTerminalSessionId(sessionTerminals, activeTerminal))
  );

// A closed tab ends the agent but keeps the session listed, so clicking it can resume.
const forgetClosedTerminal = Effect.fn("TerminalClient.forgetClosedTerminal")(
  function* (sessionTerminals: SessionTerminalsReference, closedTerminal: Terminal) {
    const sessionId = yield* findTerminalSessionId(sessionTerminals, closedTerminal);

    yield* SubscriptionRef.update(sessionTerminals, (currentTerminals) => {
      const remainingTerminals = new Map(currentTerminals);
      remainingTerminals.delete(sessionId);

      return remainingTerminals;
    });
  },
  Effect.catchTag("UntrackedTerminal", () => Effect.void)
);

// The session in front of the user: the window has focus, the active tab is a terminal, and that terminal is ours. A
// tab does not say which terminal it holds, so the active terminal fills that in.
const readViewedSessionId = Effect.fn("TerminalClient.readViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies
) {
  const {TabInputTerminal, window} = terminalDependencies;
  if (!window.state.focused) return yield* new WindowUnfocused();
  const {activeTab} = window.tabGroups.activeTabGroup;
  if (activeTab === undefined || !(activeTab.input instanceof TabInputTerminal)) return yield* new NotATerminalTab();
  const {activeTerminal} = window;
  if (activeTerminal === undefined) return yield* new NoActiveTerminal();

  return yield* findTerminalSessionId(terminalDependencies.sessionTerminals, activeTerminal);
});

const updateViewedSessionId = Effect.fn("TerminalClient.updateViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies,
  viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<SessionId, NoViewedSession>>
) {
  const nextViewedSessionId = yield* Effect.result(readViewedSessionId(terminalDependencies));
  const currentViewedSessionId = yield* SubscriptionRef.get(viewedSessionId);
  if (Result.getOrUndefined(nextViewedSessionId) === Result.getOrUndefined(currentViewedSessionId)) return;

  yield* SubscriptionRef.set(viewedSessionId, nextViewedSessionId);
});

// Switching tabs fires the tab and active-terminal events separately and in either order, so wait for them to settle;
// reading in between could credit the tab being left.
const watchFocusChanges = ({sessionTerminals, window}: TerminalDependencies) => {
  const focusChangeSources: readonly Stream.Stream<unknown>[] = [
    fromEvent(window.onDidChangeActiveTerminal),
    fromEvent(window.onDidChangeWindowState),
    fromEvent(window.tabGroups.onDidChangeTabs),
    fromEvent(window.tabGroups.onDidChangeTabGroups),
    SubscriptionRef.changes(sessionTerminals)
  ];

  return Stream.debounce(Stream.mergeAll(focusChangeSources, {concurrency: "unbounded"}), "100 millis");
};

const trackViewedSessionId = Effect.fn("TerminalClient.trackViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies
) {
  const viewedSessionId = yield* SubscriptionRef.make(yield* Effect.result(readViewedSessionId(terminalDependencies)));
  yield* Effect.forkScoped(
    Stream.runForEach(watchFocusChanges(terminalDependencies), () =>
      updateViewedSessionId(terminalDependencies, viewedSessionId)
    )
  );

  return viewedSessionId;
});

const makeTerminalDependencies = Effect.fn("TerminalClient.makeTerminalDependencies")(function* () {
  const terminalDependencies: TerminalDependencies = {
    ...(yield* StatusService),
    ...(yield* VsCodeService),
    claudeIconPath: yield* getClaudeIcon(),
    sessionTerminals: yield* SubscriptionRef.make<ReadonlyMap<SessionId, Terminal>>(new Map())
  };

  return terminalDependencies;
});

const makeTerminalClientOnVsCode = Effect.fn("TerminalClient.make")(function* () {
  const terminalDependencies = yield* makeTerminalDependencies();
  const {sessionTerminals, window} = terminalDependencies;
  yield* Effect.forkScoped(
    Stream.runForEach(fromEvent(window.onDidCloseTerminal), (closedTerminal) =>
      forgetClosedTerminal(sessionTerminals, closedTerminal)
    )
  );

  return {
    activatedSessionIds: watchActivatedSessionIds(terminalDependencies),
    closeSessionTerminal: (sessionId: SessionId) => closeSessionTerminal(sessionTerminals, sessionId),
    focusSessionTerminal: (sessionId: SessionId) => focusSessionTerminal(sessionTerminals, sessionId),
    isSessionTerminalOpen: (sessionId: SessionId) => isSessionTerminalOpen(sessionTerminals, sessionId),
    openSessionIds: Stream.map(
      SubscriptionRef.changes(sessionTerminals),
      (openTerminals): ReadonlySet<SessionId> => new Set(openTerminals.keys())
    ),
    openSessionTerminal: (session: Session, terminalLaunch: TerminalLaunch) =>
      openSessionTerminal(terminalDependencies, session, terminalLaunch),
    viewedSessionId: yield* trackViewedSessionId(terminalDependencies)
  };
});

export const TerminalClientOnVsCode = Layer.effect(TerminalClient, makeTerminalClientOnVsCode());
