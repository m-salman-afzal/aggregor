import {
  assignShownFolderShellPath,
  findFolderShellTerminalProcessId,
  openFolderShellTerminal,
  prepareFolderShellTerminalOptions,
  watchFolderShellPathsClosedByUser
} from "@infraServices/vscode/terminal/folderShellTerminal.utils.ts";
import {
  findOpenSessionTerminals,
  findTrackedSessionId,
  nameActiveSessionTab,
  pinSessionTab,
  readTerminalProcessId
} from "@infraServices/vscode/terminal/terminal.utils.ts";
import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {
  ITerminalInfraService,
  NoSessionTabOpenError,
  NoViewedSessionError,
  TerminalLaunchFailedError,
  TerminalNotFoundError
} from "@interfaces/terminal.infraService.interface.ts";
import {AGENT_ICON} from "@pkg/constants/src/agent.constant.ts";
import {SETUP_TERMINAL} from "@pkg/constants/src/requiredTools.constant.ts";
import {SESSION_ID_ENV, VIEWED_SESSION_SETTLE_INTERVAL} from "@pkg/constants/src/terminal.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {Array, Effect, Layer, Result, Schema, Stream, SubscriptionRef} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {
  SessionTerminalsReference,
  TerminalDependencies
} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {
  FolderShellTerminalRequest,
  SessionTabRequest,
  TerminalCommand
} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Terminal} from "vscode";

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

// The tab is transient: VS Code drops a reattached tab's file icon, so it isn't kept over a reload or restored.
const launchSessionTerminal = Effect.fn("TerminalInfraService.launchSessionTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  session: SessionEntity,
  sessionTabRequest: SessionTabRequest
) {
  return yield* Effect.try({
    catch: (cause) => TerminalLaunchFailedError.make({cause}),
    try: () =>
      terminalDependencies.window.createTerminal({
        cwd: session.workingFolderPath,
        env: {[SESSION_ID_ENV]: session.id},
        iconPath: sessionTabRequest.isShared
          ? terminalDependencies.Uri.joinPath(terminalDependencies.extensionUri, AGENT_ICON.DEFAULT)
          : terminalDependencies.Uri.file(sessionTabRequest.icon),
        isTransient: true,
        location: {viewColumn: terminalDependencies.ViewColumn.Active},
        name: sessionTabRequest.tabName,
        shellArgs: [...sessionTabRequest.tabCommand.commandArguments],
        shellPath: sessionTabRequest.tabCommand.command
      })
  });
});

const showTerminal = Effect.fn("TerminalInfraService.showTerminal")(function* (terminal: Terminal) {
  yield* Effect.sync(() => {
    terminal.show();
  });
});

const openSetupTerminal = Effect.fn("TerminalInfraService.openSetupTerminal")(function* (
  window: TerminalDependencies["window"],
  commandLine: string
) {
  yield* Effect.annotateCurrentSpan({commandLine});

  yield* Effect.sync(() => {
    window
      .createTerminal({
        name: SETUP_TERMINAL.NAME,
        shellArgs: ["-c", `${commandLine}${SETUP_TERMINAL.CLOSE_PROMPT}`],
        shellPath: SETUP_TERMINAL.SHELL
      })
      .show();
  });
});

const focusSessionTerminal = Effect.fn("TerminalInfraService.focusSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: EntityIdValueObject
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);
  yield* showTerminal(sessionTerminal);
});

// tmux can attach any open session tab to another session, so the first one is taken.
const findOpenSessionTerminalProcessId = Effect.fn("TerminalInfraService.findOpenSessionTerminalProcessId")(function* (
  sessionTerminals: SessionTerminalsReference
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
  const openTerminal = yield* Effect.fromResult(
    Result.fromOption(Array.head([...openTerminals.values()]), () => NoSessionTabOpenError.make())
  );
  const terminalProcessId = yield* readTerminalProcessId(openTerminal);

  return yield* Effect.fromResult(Result.fromNullishOr(terminalProcessId, () => NoSessionTabOpenError.make()));
});

// A tab tmux lists no client for, such as one still starting, keeps the session it has.
const findShownSessionTerminal = Effect.fn("TerminalInfraService.findShownSessionTerminal")(function* (
  shownSessionIdsByTabProcessId: ReadonlyMap<number, EntityIdValueObject>,
  assignedSessionId: EntityIdValueObject,
  sessionTerminal: Terminal
) {
  const terminalProcessId = yield* readTerminalProcessId(sessionTerminal);
  const shownSessionId =
    terminalProcessId === undefined ? undefined : shownSessionIdsByTabProcessId.get(terminalProcessId);

  return [shownSessionId === undefined ? assignedSessionId : shownSessionId, sessionTerminal] as const;
});

// Serialized on the map's permit, so a double-click shows the terminal the first click launched.
const openSessionTerminal = Effect.fn("TerminalInfraService.openSessionTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  session: SessionEntity,
  sessionTabRequest: SessionTabRequest
) {
  const sessionTerminal = yield* SubscriptionRef.modifyEffect(
    terminalDependencies.sessionTerminals,
    (currentTerminals) => {
      const existingTerminal = currentTerminals.get(session.id);
      if (existingTerminal !== undefined) return Effect.succeed([existingTerminal, currentTerminals] as const);

      return Effect.map(
        launchSessionTerminal(terminalDependencies, session, sessionTabRequest),
        (launchedTerminal) => [launchedTerminal, new Map(currentTerminals).set(session.id, launchedTerminal)] as const
      );
    }
  );

  yield* showTerminal(sessionTerminal);
  if (sessionTabRequest.isPinned) yield* pinSessionTab(terminalDependencies, sessionTerminal);
});

const closeOtherSessionTerminals = Effect.fn("TerminalInfraService.closeOtherSessionTerminals")(function* (
  sessionTerminals: SessionTerminalsReference,
  shownSessionId: EntityIdValueObject
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

  yield* Effect.sync(() => {
    for (const [sessionId, sessionTerminal] of openTerminals) {
      if (sessionId !== shownSessionId) sessionTerminal.dispose();
    }
  });
});

const forgetClosedTerminal = Effect.fn("TerminalInfraService.forgetClosedTerminal")(
  function* (sessionTerminals: SessionTerminalsReference, closedTerminal: Terminal) {
    const sessionId = yield* findTrackedSessionId(sessionTerminals, closedTerminal);

    yield* SubscriptionRef.update(sessionTerminals, (currentTerminals) => {
      const remainingTerminals = new Map(currentTerminals);
      remainingTerminals.delete(sessionId);

      return remainingTerminals;
    });
  },
  Effect.catchTag("UntrackedTerminalError", () => Effect.void)
);

// onDidCloseTerminal fires later, so the entry goes now, or a tab opened at once for the session would reuse the disposed one.
const closeSessionTerminal = Effect.fn("TerminalInfraService.closeSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: EntityIdValueObject
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);
  yield* forgetClosedTerminal(sessionTerminals, sessionTerminal);

  yield* Effect.sync(() => {
    sessionTerminal.dispose();
  });
});

const findActiveTerminalSessionId = Effect.fn("TerminalInfraService.findActiveTerminalSessionId")(function* (
  sessionTerminals: SessionTerminalsReference,
  activeTerminal: Terminal | undefined
) {
  const terminal = yield* Effect.fromResult(Result.fromNullishOr(activeTerminal, () => NoActiveTerminalError.make()));

  return yield* findTrackedSessionId(sessionTerminals, terminal);
});

const watchActivatedSessionIds = Effect.fn("TerminalInfraService.watchActivatedSessionIds")(function* (
  terminalDependencies: TerminalDependencies
) {
  const activeTerminalChanges = yield* streamVsCodeEvent(terminalDependencies.window.onDidChangeActiveTerminal);

  return Stream.filterMapEffect(activeTerminalChanges, (activeTerminal) =>
    Effect.result(findActiveTerminalSessionId(terminalDependencies.sessionTerminals, activeTerminal))
  );
});

const forgetClosedTerminals = Effect.fn("TerminalInfraService.forgetClosedTerminals")(function* (
  terminalDependencies: TerminalDependencies
) {
  const closedTerminals = yield* streamVsCodeEvent(terminalDependencies.window.onDidCloseTerminal);
  yield* Effect.forkScoped(
    Stream.runForEach(closedTerminals, (closedTerminal) =>
      forgetClosedTerminal(terminalDependencies.sessionTerminals, closedTerminal)
    )
  );
});

// A tab does not say which terminal it holds, so the active terminal fills that in.
const readViewedSessionId = Effect.fn("TerminalInfraService.readViewedSessionId")(function* (
  terminalDependencies: TerminalDependencies
) {
  if (!terminalDependencies.window.state.focused) return yield* WindowUnfocusedError.make();
  if (
    terminalDependencies.window.tabGroups.activeTabGroup.activeTab === undefined ||
    !(
      terminalDependencies.window.tabGroups.activeTabGroup.activeTab.input instanceof
      terminalDependencies.TabInputTerminal
    )
  )
    return yield* NotATerminalTabError.make();
  if (terminalDependencies.window.activeTerminal === undefined) return yield* NoActiveTerminalError.make();

  return yield* findTrackedSessionId(terminalDependencies.sessionTerminals, terminalDependencies.window.activeTerminal);
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

// The session in view is read at once, since the jobs that start next read it before the focus changes settle.
const assignShownSessions = Effect.fn("TerminalInfraService.assignShownSessions")(function* (
  terminalDependencies: TerminalDependencies,
  viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<EntityIdValueObject, NoViewedSessionError>>,
  shownSessionIdsByTabProcessId: ReadonlyMap<number, EntityIdValueObject>
) {
  yield* SubscriptionRef.updateEffect(terminalDependencies.sessionTerminals, (currentTerminals) =>
    Effect.map(
      Effect.forEach([...currentTerminals], ([assignedSessionId, sessionTerminal]) =>
        findShownSessionTerminal(shownSessionIdsByTabProcessId, assignedSessionId, sessionTerminal)
      ),
      (shownSessionTerminals): ReadonlyMap<EntityIdValueObject, Terminal> => new Map(shownSessionTerminals)
    )
  );
  yield* updateViewedSessionId(terminalDependencies, viewedSessionId);
});

// Reading between the events of one tab switch could credit the tab being left.
const watchFocusChanges = Effect.fn("TerminalInfraService.watchFocusChanges")(function* (
  terminalDependencies: TerminalDependencies
) {
  const focusChangeSources: readonly Stream.Stream<unknown>[] = [
    yield* streamVsCodeEvent(terminalDependencies.window.onDidChangeActiveTerminal),
    yield* streamVsCodeEvent(terminalDependencies.window.onDidChangeWindowState),
    yield* streamVsCodeEvent(terminalDependencies.window.tabGroups.onDidChangeTabs),
    yield* streamVsCodeEvent(terminalDependencies.window.tabGroups.onDidChangeTabGroups),
    SubscriptionRef.changes(terminalDependencies.sessionTerminals)
  ];

  return Stream.debounce(
    Stream.mergeAll(focusChangeSources, {concurrency: "unbounded"}),
    VIEWED_SESSION_SETTLE_INTERVAL
  );
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

const watchClosedSetupTerminals = Effect.fn("TerminalInfraService.watchClosedSetupTerminals")(function* (
  window: TerminalDependencies["window"]
) {
  const closedTerminals = yield* streamVsCodeEvent(window.onDidCloseTerminal);

  return Stream.as(
    Stream.filter(closedTerminals, (closedTerminal) => closedTerminal.name === SETUP_TERMINAL.NAME),
    undefined
  );
});

const makeTerminalDependencies = Effect.fn("TerminalInfraService.makeTerminalDependencies")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const openSessionTerminals = yield* findOpenSessionTerminals(vsCodeApi.window.terminals);
  const terminalDependencies: TerminalDependencies = {
    ...vsCodeApi,
    aggregorFolderPath: yield* getAggregorFolderPath(),
    sessionTerminals: yield* SubscriptionRef.make(openSessionTerminals),
    shownFolderShellPath: yield* SubscriptionRef.make<ProjectPathValueObject | undefined>(undefined)
  };

  return terminalDependencies;
});

const makeFolderShellMembers = Effect.fn("TerminalInfraService.makeFolderShellMembers")(function* (
  terminalDependencies: TerminalDependencies
) {
  return {
    assignShownFolderShellPath: (folderPath: ProjectPathValueObject) =>
      assignShownFolderShellPath(terminalDependencies.shownFolderShellPath, folderPath),
    findFolderShellTerminalProcessId: findFolderShellTerminalProcessId(terminalDependencies.window),
    folderShellPathsClosedByUser: yield* watchFolderShellPathsClosedByUser(terminalDependencies),
    openFolderShellTerminal: (folderShellTerminalRequest: FolderShellTerminalRequest) =>
      openFolderShellTerminal(terminalDependencies, folderShellTerminalRequest),
    prepareFolderShellTerminalOptions: (terminalCommand: TerminalCommand) =>
      prepareFolderShellTerminalOptions(terminalDependencies.aggregorFolderPath, terminalCommand)
  };
});

const makeTerminalInfraService = Effect.fn("TerminalInfraService.make")(function* () {
  const terminalDependencies = yield* makeTerminalDependencies();
  yield* forgetClosedTerminals(terminalDependencies);
  const viewedSessionId = yield* trackViewedSessionId(terminalDependencies);

  return {
    activatedSessionIds: yield* watchActivatedSessionIds(terminalDependencies),
    assignShownSessions: (shownSessionIdsByTabProcessId: ReadonlyMap<number, EntityIdValueObject>) =>
      assignShownSessions(terminalDependencies, viewedSessionId, shownSessionIdsByTabProcessId),
    closedSetupTerminals: yield* watchClosedSetupTerminals(terminalDependencies.window),
    closeOtherSessionTerminals: (shownSessionId: EntityIdValueObject) =>
      closeOtherSessionTerminals(terminalDependencies.sessionTerminals, shownSessionId),
    closeSessionTerminal: (sessionId: EntityIdValueObject) =>
      closeSessionTerminal(terminalDependencies.sessionTerminals, sessionId),
    findOpenSessionTerminalProcessId: findOpenSessionTerminalProcessId(terminalDependencies.sessionTerminals),
    focusSessionTerminal: (sessionId: EntityIdValueObject) =>
      focusSessionTerminal(terminalDependencies.sessionTerminals, sessionId),
    nameActiveSessionTab: (sessionId: EntityIdValueObject, tabName: string) =>
      nameActiveSessionTab(terminalDependencies, sessionId, tabName),
    openSessionTerminal: (session: SessionEntity, sessionTabRequest: SessionTabRequest) =>
      openSessionTerminal(terminalDependencies, session, sessionTabRequest),
    openSetupTerminal: (commandLine: string) => openSetupTerminal(terminalDependencies.window, commandLine),
    viewedSessionId,
    ...(yield* makeFolderShellMembers(terminalDependencies))
  };
});

export const TerminalInfraService = Layer.effect(ITerminalInfraService, makeTerminalInfraService());
