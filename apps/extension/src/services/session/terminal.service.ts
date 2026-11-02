import {
  NoActiveTerminal,
  NotATerminalTab,
  TerminalLaunchFailed,
  TerminalNotFound,
  UntrackedTerminal,
  WindowUnfocused
} from "@/errors/session.error.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {fromEvent, getClaudeIcon} from "@/services/vscode.utils.ts";
import {STATUS_ENV} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {Session} from "@/services/session/store.service.ts";
import type {Terminal, Uri} from "vscode";

// Why no session is in front of the user.
type NoViewedSession = NoActiveTerminal | NotATerminalTab | UntrackedTerminal | WindowUnfocused;

// Each session's terminal in this window, keyed by session id.
type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<string, Terminal>>;

// What the terminal functions share: the window's session terminals, VS Code's window and the status hooks.
type TerminalDependencies = {
  readonly claudeIconPath: Uri;
  readonly sessionTerminals: SessionTerminalsReference;
} & Pick<StatusService["Service"], "clearStatusFile" | "getStatusFilePath" | "hooksFilePath"> &
  Pick<VsCodeService["Service"], "TabInputTerminal" | "ViewColumn" | "window">;

// The tab is named once, when it opens: VS Code's stable API cannot rename a terminal afterwards.
interface TerminalLaunch {
  readonly claudeArguments: readonly string[];
  readonly tabName: string;
}

const findSessionTerminal = Effect.fn("TerminalService.findSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: string
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return yield* Effect.fromResult(
    Result.fromNullishOr(openTerminals.get(sessionId), () => new TerminalNotFound({sessionId}))
  );
});

const isSessionTerminalOpen = Effect.fn("TerminalService.isSessionTerminalOpen")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: string
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return openTerminals.has(sessionId);
});

// ponytail: linear scan, a window holds a handful of sessions
const findTerminalSessionId = Effect.fn("TerminalService.findTerminalSessionId")(function* (
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
const launchSessionTerminal = Effect.fn("TerminalService.launchSessionTerminal")(function* (
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
        cwd: session.cwd,
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

const showTerminal = Effect.fn("TerminalService.showTerminal")(function* (terminal: Terminal) {
  yield* Effect.sync(() => {
    terminal.show();
  });
});

const focusSessionTerminal = Effect.fn("TerminalService.focusSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: string
) {
  yield* showTerminal(yield* findSessionTerminal(sessionTerminals, sessionId));
});

// Reuses the session's terminal when this window has one. Serialized on the map's permit, so a double-click shows the
// terminal the first click launched.
const openSessionTerminal = Effect.fn("TerminalService.openSessionTerminal")(function* (
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
const closeSessionTerminal = Effect.fn("TerminalService.closeSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: string
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);

  yield* Effect.sync(() => {
    sessionTerminal.dispose();
  });
});

// A closed tab ends the agent but keeps the session listed, so clicking it can resume.
const forgetClosedTerminal = Effect.fn("TerminalService.forgetClosedTerminal")(
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
const readViewedSessionId = Effect.fn("TerminalService.readViewedSessionId")(function* (
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

const updateViewedSessionId = Effect.fn("TerminalService.updateViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies,
  viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<string, NoViewedSession>>
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

const trackViewedSessionId = Effect.fn("TerminalService.trackViewedSessionId")(function* (
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

const makeTerminalDependencies = Effect.fn("TerminalService.makeTerminalDependencies")(function* () {
  const terminalDependencies: TerminalDependencies = {
    ...(yield* StatusService),
    ...(yield* VsCodeService),
    claudeIconPath: yield* getClaudeIcon(),
    sessionTerminals: yield* SubscriptionRef.make<ReadonlyMap<string, Terminal>>(new Map())
  };

  return terminalDependencies;
});

const makeTerminalService = Effect.fn("TerminalService.make")(function* () {
  const terminalDependencies = yield* makeTerminalDependencies();
  const {sessionTerminals, window} = terminalDependencies;
  yield* Effect.forkScoped(
    Stream.runForEach(fromEvent(window.onDidCloseTerminal), (closedTerminal) =>
      forgetClosedTerminal(sessionTerminals, closedTerminal)
    )
  );

  return {
    closeSessionTerminal: (sessionId: string) => closeSessionTerminal(sessionTerminals, sessionId),
    findTerminalSessionId: (terminal: Terminal) => findTerminalSessionId(sessionTerminals, terminal),
    focusSessionTerminal: (sessionId: string) => focusSessionTerminal(sessionTerminals, sessionId),
    isSessionTerminalOpen: (sessionId: string) => isSessionTerminalOpen(sessionTerminals, sessionId),
    openSessionTerminal: (session: Session, terminalLaunch: TerminalLaunch) =>
      openSessionTerminal(terminalDependencies, session, terminalLaunch),
    sessionTerminals,
    viewedSessionId: yield* trackViewedSessionId(terminalDependencies)
  };
});

export class TerminalService extends Context.Service<
  TerminalService,
  {
    readonly closeSessionTerminal: (sessionId: string) => Effect.Effect<void, TerminalNotFound>;
    readonly findTerminalSessionId: (terminal: Terminal) => Effect.Effect<string, UntrackedTerminal>;
    readonly focusSessionTerminal: (sessionId: string) => Effect.Effect<void, TerminalNotFound>;
    readonly isSessionTerminalOpen: (sessionId: string) => Effect.Effect<boolean>;
    readonly openSessionTerminal: (
      session: Session,
      terminalLaunch: TerminalLaunch
    ) => Effect.Effect<void, TerminalLaunchFailed>;
    readonly sessionTerminals: SessionTerminalsReference;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<string, NoViewedSession>>;
  }
>()("aggregor/services/session/terminal.service/TerminalService") {
  public static readonly layer = Layer.effect(TerminalService, makeTerminalService());
}
