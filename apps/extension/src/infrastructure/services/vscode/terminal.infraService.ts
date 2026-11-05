import {
  NoActiveTerminalError,
  NotATerminalTabError,
  TerminalLaunchFailedError,
  TerminalNotFoundError,
  UntrackedTerminalError,
  WindowUnfocusedError
} from "@/application/errors/terminal.infraService.error.ts";
import {ITerminalInfraService} from "@/application/interfaces/terminal.infraService.interface.ts";
import {fromEvent} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {NoViewedSessionError} from "@/application/errors/terminal.infraService.error.ts";
import type {TerminalLaunchRequest} from "@/application/interfaces/terminal.infraService.type.ts";
import type {SessionEntity} from "@/domain/entities/session/session.entity.ts";
import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";
import type {Terminal} from "vscode";

// Each session's terminal in this window, keyed by session id.
type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionIdValueObject, Terminal>>;

// What the terminal functions share: the window's session terminals and VS Code's window.
type TerminalDependencies = {
  readonly sessionTerminals: SessionTerminalsReference;
} & Pick<VsCodeApi["Service"], "TabInputTerminal" | "Uri" | "ViewColumn" | "window">;

const findSessionTerminal = Effect.fn("TerminalInfraService.findSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionIdValueObject
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return yield* Effect.fromResult(
    Result.fromNullishOr(openTerminals.get(sessionId), () => new TerminalNotFoundError({sessionId}))
  );
});

const isSessionTerminalOpen = Effect.fn("TerminalInfraService.isSessionTerminalOpen")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionIdValueObject
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return openTerminals.has(sessionId);
});

// ponytail: linear scan, a window holds a handful of sessions
const findTerminalSessionId = Effect.fn("TerminalInfraService.findTerminalSessionId")(function* (
  sessionTerminals: SessionTerminalsReference,
  terminal: Terminal
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
  const [sessionId] = yield* Effect.fromResult(
    Result.fromNullishOr(
      [...openTerminals].find(([, openTerminal]) => openTerminal === terminal),
      () => new UntrackedTerminalError()
    )
  );

  return sessionId;
});

// Runs the harness's launch plan as the terminal's shell, in the session's project.
const launchSessionTerminal = Effect.fn("TerminalInfraService.launchSessionTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  session: SessionEntity,
  terminalLaunchRequest: TerminalLaunchRequest
) {
  const {Uri, ViewColumn, window} = terminalDependencies;
  const {iconPath, launchPlan, tabName} = terminalLaunchRequest;

  return yield* Effect.try({
    catch: (cause) => new TerminalLaunchFailedError({cause}),
    try: () =>
      window.createTerminal({
        cwd: session.projectPath,
        env: launchPlan.environmentVariables,
        iconPath: Uri.file(iconPath),
        isTransient: true,
        location: {viewColumn: ViewColumn.Active},
        name: tabName,
        shellArgs: [...launchPlan.commandArguments],
        shellPath: launchPlan.command
      })
  });
});

const showTerminal = Effect.fn("TerminalInfraService.showTerminal")(function* (terminal: Terminal) {
  yield* Effect.sync(() => {
    terminal.show();
  });
});

const focusSessionTerminal = Effect.fn("TerminalInfraService.focusSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionIdValueObject
) {
  yield* showTerminal(yield* findSessionTerminal(sessionTerminals, sessionId));
});

// Reuses the session's terminal when this window has one. Serialized on the map's permit, so a double-click shows the
// terminal the first click launched.
const openSessionTerminal = Effect.fn("TerminalInfraService.openSessionTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  session: SessionEntity,
  terminalLaunchRequest: TerminalLaunchRequest
) {
  const sessionTerminal = yield* SubscriptionRef.modifyEffect(
    terminalDependencies.sessionTerminals,
    (currentTerminals) => {
      const existingTerminal = currentTerminals.get(session.id);
      if (existingTerminal !== undefined) return Effect.succeed([existingTerminal, currentTerminals] as const);

      return Effect.map(
        launchSessionTerminal(terminalDependencies, session, terminalLaunchRequest),
        (launchedTerminal) => [launchedTerminal, new Map(currentTerminals).set(session.id, launchedTerminal)] as const
      );
    }
  );

  yield* showTerminal(sessionTerminal);
});

// Disposing fires onDidCloseTerminal, which drops the map entry.
const closeSessionTerminal = Effect.fn("TerminalInfraService.closeSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: SessionIdValueObject
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);

  yield* Effect.sync(() => {
    sessionTerminal.dispose();
  });
});

const findActiveTerminalSessionId = Effect.fn("TerminalInfraService.findActiveTerminalSessionId")(function* (
  sessionTerminals: SessionTerminalsReference,
  activeTerminal: Terminal | undefined
) {
  const terminal = yield* Effect.fromResult(Result.fromNullishOr(activeTerminal, () => new NoActiveTerminalError()));

  return yield* findTerminalSessionId(sessionTerminals, terminal);
});

// No active terminal, or one that is not a session's, emits nothing.
const watchActivatedSessionIds = ({sessionTerminals, window}: TerminalDependencies) =>
  Stream.filterMapEffect(fromEvent(window.onDidChangeActiveTerminal), (activeTerminal) =>
    Effect.result(findActiveTerminalSessionId(sessionTerminals, activeTerminal))
  );

// A closed tab ends the agent but keeps the session listed, so clicking it can resume.
const forgetClosedTerminal = Effect.fn("TerminalInfraService.forgetClosedTerminal")(
  function* (sessionTerminals: SessionTerminalsReference, closedTerminal: Terminal) {
    const sessionId = yield* findTerminalSessionId(sessionTerminals, closedTerminal);

    yield* SubscriptionRef.update(sessionTerminals, (currentTerminals) => {
      const remainingTerminals = new Map(currentTerminals);
      remainingTerminals.delete(sessionId);

      return remainingTerminals;
    });
  },
  Effect.catchTag("UntrackedTerminalError", () => Effect.void)
);

// The session in front of the user: the window has focus, the active tab is a terminal, and that terminal is ours. A
// tab does not say which terminal it holds, so the active terminal fills that in.
const readViewedSessionId = Effect.fn("TerminalInfraService.readViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies
) {
  const {TabInputTerminal, window} = terminalDependencies;
  if (!window.state.focused) return yield* new WindowUnfocusedError();
  const {activeTab} = window.tabGroups.activeTabGroup;
  if (activeTab === undefined || !(activeTab.input instanceof TabInputTerminal))
    return yield* new NotATerminalTabError();
  const {activeTerminal} = window;
  if (activeTerminal === undefined) return yield* new NoActiveTerminalError();

  return yield* findTerminalSessionId(terminalDependencies.sessionTerminals, activeTerminal);
});

const updateViewedSessionId = Effect.fn("TerminalInfraService.updateViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies,
  viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<SessionIdValueObject, NoViewedSessionError>>
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

const trackViewedSessionId = Effect.fn("TerminalInfraService.trackViewedSessionId")(function* (
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

const makeTerminalDependencies = Effect.fn("TerminalInfraService.makeTerminalDependencies")(function* () {
  const terminalDependencies: TerminalDependencies = {
    ...(yield* VsCodeApi),
    sessionTerminals: yield* SubscriptionRef.make<ReadonlyMap<SessionIdValueObject, Terminal>>(new Map())
  };

  return terminalDependencies;
});

const makeTerminalInfraService = Effect.fn("TerminalInfraService.make")(function* () {
  const terminalDependencies = yield* makeTerminalDependencies();
  const {sessionTerminals, window} = terminalDependencies;
  yield* Effect.forkScoped(
    Stream.runForEach(fromEvent(window.onDidCloseTerminal), (closedTerminal) =>
      forgetClosedTerminal(sessionTerminals, closedTerminal)
    )
  );

  return {
    activatedSessionIds: watchActivatedSessionIds(terminalDependencies),
    closeSessionTerminal: (sessionId: SessionIdValueObject) => closeSessionTerminal(sessionTerminals, sessionId),
    focusSessionTerminal: (sessionId: SessionIdValueObject) => focusSessionTerminal(sessionTerminals, sessionId),
    isSessionTerminalOpen: (sessionId: SessionIdValueObject) => isSessionTerminalOpen(sessionTerminals, sessionId),
    openSessionIds: Stream.map(
      SubscriptionRef.changes(sessionTerminals),
      (openTerminals): ReadonlySet<SessionIdValueObject> => new Set(openTerminals.keys())
    ),
    openSessionTerminal: (session: SessionEntity, terminalLaunchRequest: TerminalLaunchRequest) =>
      openSessionTerminal(terminalDependencies, session, terminalLaunchRequest),
    viewedSessionId: yield* trackViewedSessionId(terminalDependencies)
  };
});

export const TerminalInfraService = Layer.effect(ITerminalInfraService, makeTerminalInfraService());
