import {
  findFolderTerminal,
  findOpenSessionTerminals,
  findTrackedSessionId,
  isSessionTerminal,
  nameActiveSessionTab,
  readTerminalFolderPath
} from "@infraServices/vscode/terminal/terminal.utils.ts";
import {
  ITerminalInfraService,
  NoViewedSessionError,
  TerminalLaunchFailedError,
  TerminalNotFoundError
} from "@interfaces/terminal.infraService.interface.ts";
import {FOLDER_PATH_ENV, SESSION_ID_ENV, VIEWED_SESSION_SETTLE_INTERVAL} from "@pkg/constants/src/terminal.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {Effect, Layer, Ref, Result, Schema, Stream, SubscriptionRef} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {
  SessionTerminalsReference,
  TerminalDependencies
} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {FolderTerminalRequest, SessionTabRequest} from "@interfaces/terminal.infraService.interface.ts";
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
        iconPath: terminalDependencies.Uri.file(sessionTabRequest.icon),
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

const launchFolderTerminal = Effect.fn("TerminalInfraService.launchFolderTerminal")(function* (
  window: TerminalDependencies["window"],
  folderTerminalRequest: FolderTerminalRequest
) {
  return yield* Effect.try({
    catch: (cause) => TerminalLaunchFailedError.make({cause}),
    try: () =>
      window.createTerminal({
        cwd: folderTerminalRequest.folderPath,
        env: {[FOLDER_PATH_ENV]: folderTerminalRequest.folderPath},
        name: folderTerminalRequest.terminalName
      })
  });
});

const findOrLaunchFolderTerminal = Effect.fn("TerminalInfraService.findOrLaunchFolderTerminal")(
  function* (window: TerminalDependencies["window"], folderTerminalRequest: FolderTerminalRequest) {
    return yield* findFolderTerminal(window.terminals, folderTerminalRequest.folderPath);
  },
  (effect, window, folderTerminalRequest) =>
    Effect.catchTag(effect, "FolderTerminalNotFoundError", () => launchFolderTerminal(window, folderTerminalRequest))
);

const openFolderTerminal = Effect.fn("TerminalInfraService.openFolderTerminal")(function* (
  window: TerminalDependencies["window"],
  folderTerminalRequest: FolderTerminalRequest
) {
  const folderTerminal = yield* findOrLaunchFolderTerminal(window, folderTerminalRequest);
  yield* showTerminal(folderTerminal);
});

const closeFolderTerminal = Effect.fn("TerminalInfraService.closeFolderTerminal")(
  function* (window: TerminalDependencies["window"], folderPath: ProjectPathValueObject) {
    const folderTerminal = yield* findFolderTerminal(window.terminals, folderPath);

    yield* Effect.sync(() => {
      folderTerminal.dispose();
    });
  },
  Effect.catchTag("FolderTerminalNotFoundError", () => Effect.void)
);

const findWorkingFolderTerminal = Effect.fn("TerminalInfraService.findWorkingFolderTerminal")(function* (
  terminals: readonly Terminal[],
  workingFolderPath: ProjectPathValueObject,
  projectPath: ProjectPathValueObject
) {
  return yield* Effect.catchTag(findFolderTerminal(terminals, workingFolderPath), "FolderTerminalNotFoundError", () =>
    findFolderTerminal(terminals, projectPath)
  );
});

// Only in place of another folder's terminal, so a shell the user opened stays in front.
const switchToFolderTerminal = Effect.fn("TerminalInfraService.switchToFolderTerminal")(
  function* (
    terminalDependencies: TerminalDependencies,
    workingFolderPath: ProjectPathValueObject,
    projectPath: ProjectPathValueObject
  ) {
    const shellTerminal = yield* Ref.get(terminalDependencies.shellTerminal);
    if (shellTerminal === undefined || shellTerminal.exitStatus !== undefined) return;
    if ((yield* readTerminalFolderPath(shellTerminal)) === undefined) return;
    const folderTerminal = yield* findWorkingFolderTerminal(
      terminalDependencies.window.terminals,
      workingFolderPath,
      projectPath
    );
    if (folderTerminal === shellTerminal) return;

    yield* Effect.sync(() => {
      folderTerminal.show(true);
    });
  },
  Effect.catchTag("FolderTerminalNotFoundError", () => Effect.void)
);

const focusSessionTerminal = Effect.fn("TerminalInfraService.focusSessionTerminal")(function* (
  sessionTerminals: SessionTerminalsReference,
  sessionId: EntityIdValueObject
) {
  const sessionTerminal = yield* findSessionTerminal(sessionTerminals, sessionId);
  yield* showTerminal(sessionTerminal);
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

const rememberShellTerminal = Effect.fn("TerminalInfraService.rememberShellTerminal")(function* (
  shellTerminal: Ref.Ref<Terminal | undefined>,
  activeTerminal: Terminal | undefined
) {
  if (activeTerminal === undefined || (yield* isSessionTerminal(activeTerminal))) return;

  yield* Ref.set(shellTerminal, activeTerminal);
});

const trackShellTerminal = Effect.fn("TerminalInfraService.trackShellTerminal")(function* (
  window: TerminalDependencies["window"]
) {
  const shellTerminal = yield* Ref.make<Terminal | undefined>(undefined);
  yield* rememberShellTerminal(shellTerminal, window.activeTerminal);
  const activeTerminalChanges = yield* streamVsCodeEvent(window.onDidChangeActiveTerminal);
  yield* Effect.forkScoped(
    Stream.runForEach(activeTerminalChanges, (activeTerminal) => rememberShellTerminal(shellTerminal, activeTerminal))
  );

  return shellTerminal;
});

const makeTerminalDependencies = Effect.fn("TerminalInfraService.makeTerminalDependencies")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const openSessionTerminals = yield* findOpenSessionTerminals(vsCodeApi.window.terminals);
  const terminalDependencies: TerminalDependencies = {
    ...vsCodeApi,
    sessionTerminals: yield* SubscriptionRef.make(openSessionTerminals),
    shellTerminal: yield* trackShellTerminal(vsCodeApi.window)
  };

  return terminalDependencies;
});

const makeTerminalInfraService = Effect.fn("TerminalInfraService.make")(function* () {
  const terminalDependencies = yield* makeTerminalDependencies();
  const closedTerminals = yield* streamVsCodeEvent(terminalDependencies.window.onDidCloseTerminal);
  yield* Effect.forkScoped(
    Stream.runForEach(closedTerminals, (closedTerminal) =>
      forgetClosedTerminal(terminalDependencies.sessionTerminals, closedTerminal)
    )
  );

  return {
    activatedSessionIds: yield* watchActivatedSessionIds(terminalDependencies),
    closeFolderTerminal: (folderPath: ProjectPathValueObject) =>
      closeFolderTerminal(terminalDependencies.window, folderPath),
    closeSessionTerminal: (sessionId: EntityIdValueObject) =>
      closeSessionTerminal(terminalDependencies.sessionTerminals, sessionId),
    focusSessionTerminal: (sessionId: EntityIdValueObject) =>
      focusSessionTerminal(terminalDependencies.sessionTerminals, sessionId),
    nameActiveSessionTab: (sessionId: EntityIdValueObject, tabName: string) =>
      nameActiveSessionTab(terminalDependencies, sessionId, tabName),
    openFolderTerminal: (folderTerminalRequest: FolderTerminalRequest) =>
      openFolderTerminal(terminalDependencies.window, folderTerminalRequest),
    openSessionTerminal: (session: SessionEntity, sessionTabRequest: SessionTabRequest) =>
      openSessionTerminal(terminalDependencies, session, sessionTabRequest),
    switchToFolderTerminal: (workingFolderPath: ProjectPathValueObject, projectPath: ProjectPathValueObject) =>
      switchToFolderTerminal(terminalDependencies, workingFolderPath, projectPath),
    viewedSessionId: yield* trackViewedSessionId(terminalDependencies)
  };
});

export const TerminalInfraService = Layer.effect(ITerminalInfraService, makeTerminalInfraService());
