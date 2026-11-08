import {
  findOpenSessionTerminals,
  findTerminalSessionId,
  renameSessionTerminal,
  watchSessionTerminalTitles
} from "@infraServices/vscode/terminal/terminal.utils.ts";
import {fromEvent} from "@infraUtils/vscode.utils.ts";
import {
  ITerminalInfraService,
  NoViewedSessionError,
  TerminalLaunchFailedError,
  TerminalNotFoundError
} from "@interfaces/terminal.infraService.interface.ts";
import {SESSION_ID_ENV} from "@pkg/constants/src/extension.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Layer, Result, Schema, Stream, SubscriptionRef} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {
  SessionTerminalsReference,
  TerminalDependencies
} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {TerminalLaunchRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";
import type {Terminal} from "vscode";

// Why no session is in view, private to this file: the interface only sees NoViewedSessionError.
class NoActiveTerminalError extends Schema.TaggedError<NoActiveTerminalError, {readonly brand: unique symbol}>()(
  "NoActiveTerminalError",
  {}
) {}
class NotATerminalTabError extends Schema.TaggedError<NotATerminalTabError, {readonly brand: unique symbol}>()(
  "NotATerminalTabError",
  {}
) {}
class WindowUnfocusedError extends Schema.TaggedError<WindowUnfocusedError, {readonly brand: unique symbol}>()(
  "WindowUnfocusedError",
  {}
) {}

const findSessionTerminal = Effect.fn("TerminalInfraService.findSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: EntityIdValueObject
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return yield* Effect.fromResult(
    Result.fromNullishOr(openTerminals.get(sessionId), () => TerminalNotFoundError.make({sessionId}))
  );
});

const isSessionTerminalOpen = Effect.fn("TerminalInfraService.isSessionTerminalOpen")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: EntityIdValueObject
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  return openTerminals.has(sessionId);
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
    catch: (cause) => TerminalLaunchFailedError.make({cause}),
    try: () =>
      window.createTerminal({
        cwd: session.projectPath,
        env: {...launchPlan.environmentVariables, [SESSION_ID_ENV]: session.id},
        iconPath: Uri.file(iconPath),
        isTransient: true,
        location: {viewColumn: ViewColumn.Active},
        ...(tabName === undefined ? {} : {name: tabName}),
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

// The user's default shell, named after the project, so the tab says where it runs.
const openProjectTerminal = Effect.fn("TerminalInfraService.openProjectTerminal")(function* (
  window: TerminalDependencies["window"],
  project: ListedProjectValueObject
) {
  const projectTerminal = yield* Effect.try({
    catch: (cause) => TerminalLaunchFailedError.make({cause}),
    try: () => window.createTerminal({cwd: project.path, name: project.name})
  });

  yield* showTerminal(projectTerminal);
});

const focusSessionTerminal = Effect.fn("TerminalInfraService.focusSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: EntityIdValueObject
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);
  yield* showTerminal(sessionTerminal);
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
  sessionId: EntityIdValueObject
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);

  yield* Effect.sync(() => {
    sessionTerminal.dispose();
  });
});

const findActiveTerminalSessionId = Effect.fn("TerminalInfraService.findActiveTerminalSessionId")(function* (
  activeTerminal: Terminal | undefined
) {
  const terminal = yield* Effect.fromResult(Result.fromNullishOr(activeTerminal, () => NoActiveTerminalError.make()));

  return yield* findTerminalSessionId(terminal);
});

// No active terminal, or one that is not a session's, emits nothing.
const watchActivatedSessionIds = Effect.fn("TerminalInfraService.watchActivatedSessionIds")(function* ({
  window
}: TerminalDependencies) {
  const activeTerminalChanges = yield* fromEvent(window.onDidChangeActiveTerminal);

  return Stream.filterMapEffect(activeTerminalChanges, (activeTerminal) =>
    Effect.result(findActiveTerminalSessionId(activeTerminal))
  );
});

// A closed tab ends the agent but keeps the session listed, so clicking it can resume.
const forgetClosedTerminal = Effect.fn("TerminalInfraService.forgetClosedTerminal")(
  function* (sessionTerminals: SessionTerminalsReference, closedTerminal: Terminal) {
    const sessionId = yield* findTerminalSessionId(closedTerminal);

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
  if (!window.state.focused) return yield* WindowUnfocusedError.make();
  const {activeTab} = window.tabGroups.activeTabGroup;
  if (activeTab === undefined || !(activeTab.input instanceof TabInputTerminal))
    return yield* NotATerminalTabError.make();
  const {activeTerminal} = window;
  if (activeTerminal === undefined) return yield* NoActiveTerminalError.make();

  return yield* findTerminalSessionId(activeTerminal);
});

// The interface only says that no session is in view; readViewedSessionId's span keeps the reason.
const findViewedSessionId = Effect.fn("TerminalInfraService.findViewedSessionId")(
  function* (terminalDependencies: TerminalDependencies) {
    return yield* readViewedSessionId(terminalDependencies);
  },
  Effect.mapError(() => NoViewedSessionError.make())
);

const updateViewedSessionId = Effect.fn("TerminalInfraService.updateViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies,
  viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<EntityIdValueObject, NoViewedSessionError>>
) {
  const nextViewedSessionId = yield* Effect.result(findViewedSessionId(terminalDependencies));
  const currentViewedSessionId = yield* SubscriptionRef.get(viewedSessionId);
  if (Result.getOrUndefined(nextViewedSessionId) === Result.getOrUndefined(currentViewedSessionId)) return;

  yield* SubscriptionRef.set(viewedSessionId, nextViewedSessionId);
});

// Switching tabs fires the tab and active-terminal events separately and in either order, so wait for them to settle;
// reading in between could credit the tab being left.
const watchFocusChanges = Effect.fn("TerminalInfraService.watchFocusChanges")(function* ({
  sessionTerminals,
  window
}: TerminalDependencies) {
  const focusChangeSources: readonly Stream.Stream<unknown>[] = [
    yield* fromEvent(window.onDidChangeActiveTerminal),
    yield* fromEvent(window.onDidChangeWindowState),
    yield* fromEvent(window.tabGroups.onDidChangeTabs),
    yield* fromEvent(window.tabGroups.onDidChangeTabGroups),
    SubscriptionRef.changes(sessionTerminals)
  ];

  return Stream.debounce(Stream.mergeAll(focusChangeSources, {concurrency: "unbounded"}), "100 millis");
});

const trackViewedSessionId = Effect.fn("TerminalInfraService.trackViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies
) {
  const initialViewedSessionId = yield* Effect.result(findViewedSessionId(terminalDependencies));
  const viewedSessionId = yield* SubscriptionRef.make(initialViewedSessionId);
  const focusChanges = yield* watchFocusChanges(terminalDependencies);
  yield* Effect.forkScoped(
    Stream.runForEach(focusChanges, () => updateViewedSessionId(terminalDependencies, viewedSessionId))
  );

  return viewedSessionId;
});

const makeTerminalDependencies = Effect.fn("TerminalInfraService.makeTerminalDependencies")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const openSessionTerminals = yield* findOpenSessionTerminals(vsCodeApi.window.terminals);
  const terminalDependencies: TerminalDependencies = {
    ...vsCodeApi,
    sessionTerminals: yield* SubscriptionRef.make(openSessionTerminals)
  };

  return terminalDependencies;
});

const makeTerminalInfraService = Effect.fn("TerminalInfraService.make")(function* () {
  const terminalDependencies = yield* makeTerminalDependencies();
  const {sessionTerminals, window} = terminalDependencies;
  const closedTerminals = yield* fromEvent(window.onDidCloseTerminal);
  yield* Effect.forkScoped(
    Stream.runForEach(closedTerminals, (closedTerminal) => forgetClosedTerminal(sessionTerminals, closedTerminal))
  );

  return {
    activatedSessionIds: yield* watchActivatedSessionIds(terminalDependencies),
    closeSessionTerminal: (sessionId: EntityIdValueObject) => closeSessionTerminal(sessionTerminals, sessionId),
    focusSessionTerminal: (sessionId: EntityIdValueObject) => focusSessionTerminal(sessionTerminals, sessionId),
    isSessionTerminalOpen: (sessionId: EntityIdValueObject) => isSessionTerminalOpen(sessionTerminals, sessionId),
    openProjectTerminal: (project: ListedProjectValueObject) => openProjectTerminal(window, project),
    openSessionIds: Stream.map(
      SubscriptionRef.changes(sessionTerminals),
      (openTerminals): ReadonlySet<EntityIdValueObject> => new Set(openTerminals.keys())
    ),
    openSessionTerminal: (session: SessionEntity, terminalLaunchRequest: TerminalLaunchRequest) =>
      openSessionTerminal(terminalDependencies, session, terminalLaunchRequest),
    renameSessionTerminal: (sessionId: EntityIdValueObject, tabName: string) =>
      renameSessionTerminal(terminalDependencies, sessionId, tabName),
    sessionTerminalTitles: yield* watchSessionTerminalTitles(sessionTerminals),
    viewedSessionId: yield* trackViewedSessionId(terminalDependencies)
  };
});

export const TerminalInfraService = Layer.effect(ITerminalInfraService, makeTerminalInfraService());
