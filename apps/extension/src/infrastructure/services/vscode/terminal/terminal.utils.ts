import {FOLDER_PATH_ENV, SESSION_ID_ENV, SESSION_TAB_PIN_WAIT} from "@pkg/constants/src/terminal.constant.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Result, Schedule, Schema, SubscriptionRef} from "effect";

import type {
  SessionTerminalsReference,
  TerminalDependencies
} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Terminal} from "vscode";

class UntrackedTerminalError extends Schema.TaggedError<UntrackedTerminalError, {readonly brand: unique symbol}>()(
  "UntrackedTerminalError",
  {}
) {}

class SessionTabNotInFrontError extends Schema.TaggedError<
  SessionTabNotInFrontError,
  {readonly brand: unique symbol}
>()("SessionTabNotInFrontError", {}) {}

class FolderTerminalNotFoundError extends Schema.TaggedError<
  FolderTerminalNotFoundError,
  {readonly brand: unique symbol}
>()("FolderTerminalNotFoundError", {}) {}

const readTerminalEnvironmentVariable = Effect.fn("TerminalInfraService.readTerminalEnvironmentVariable")(function* (
  terminal: Terminal | undefined,
  variableName: string
) {
  if (terminal === undefined) return undefined;
  const environmentVariables = "env" in terminal.creationOptions ? terminal.creationOptions.env : undefined;

  return environmentVariables === undefined ? undefined : environmentVariables[variableName];
});

export const readTerminalFolderPath = Effect.fn("TerminalInfraService.readTerminalFolderPath")(function* (
  terminal: Terminal | undefined
) {
  return yield* readTerminalEnvironmentVariable(terminal, FOLDER_PATH_ENV);
});

export const isSessionTerminal = Effect.fn("TerminalInfraService.isSessionTerminal")(function* (terminal: Terminal) {
  const sessionIdValue = yield* readTerminalEnvironmentVariable(terminal, SESSION_ID_ENV);

  return sessionIdValue !== undefined;
});

export const findFolderTerminal = Effect.fn("TerminalInfraService.findFolderTerminal")(function* (
  terminals: readonly Terminal[],
  folderPath: string
) {
  const terminalFolderPaths = yield* Effect.forEach(terminals, (terminal) => readTerminalFolderPath(terminal));
  const folderTerminal = Array.findFirst(
    terminals,
    (terminal, terminalIndex) => terminal.exitStatus === undefined && terminalFolderPaths[terminalIndex] === folderPath
  );

  return yield* Effect.fromResult(Result.fromOption(folderTerminal, () => FolderTerminalNotFoundError.make()));
});

// VS Code keeps the session id a tab is opened with for the tab's whole life, through an extension restart too.
const identifySessionTerminal = Effect.fn("TerminalInfraService.identifySessionTerminal")(
  function* (terminal: Terminal) {
    const sessionIdValue = yield* readTerminalEnvironmentVariable(terminal, SESSION_ID_ENV);

    return yield* Effect.fromResult(decodeEntityId(sessionIdValue));
  },
  Effect.mapError(() => UntrackedTerminalError.make())
);

// Session tabs outlive the extension host, which restarts when the window turns into a multi-root workspace.
export const findOpenSessionTerminals = Effect.fn("TerminalInfraService.findOpenSessionTerminals")(function* (
  terminals: readonly Terminal[]
) {
  const sessionTerminalResults = yield* Effect.forEach(terminals, (terminal) =>
    Effect.result(Effect.map(identifySessionTerminal(terminal), (sessionId) => [sessionId, terminal] as const))
  );
  const openSessionTerminals: ReadonlyMap<EntityIdValueObject, Terminal> = new Map(
    Array.getSuccesses(sessionTerminalResults)
  );

  return openSessionTerminals;
});

export const findTrackedSessionId = Effect.fn("TerminalInfraService.findTrackedSessionId")(function* (
  sessionTerminals: SessionTerminalsReference,
  terminal: Terminal
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
  const trackedEntry = Array.findFirst([...openTerminals], ([, sessionTerminal]) => sessionTerminal === terminal);

  return yield* Effect.fromResult(
    Result.map(
      Result.fromOption(trackedEntry, () => UntrackedTerminalError.make()),
      ([sessionId]) => sessionId
    )
  );
});

// VS Code renames only the active terminal, so the tab comes to the front first.
const renameActiveTerminal = Effect.fn("TerminalInfraService.renameActiveTerminal")(function* (
  commands: TerminalDependencies["commands"],
  tabName: string
) {
  yield* Effect.promise(() => commands.executeCommand(VS_CODE_COMMANDS.RENAME_ACTIVE_TERMINAL, {name: tabName}));
});

export const nameActiveSessionTab = Effect.fn("TerminalInfraService.nameActiveSessionTab")(function* (
  terminalDependencies: TerminalDependencies,
  sessionId: EntityIdValueObject,
  tabName: string
) {
  const openTerminals = yield* SubscriptionRef.get(terminalDependencies.sessionTerminals);
  const sessionTerminal = openTerminals.get(sessionId);
  if (
    sessionTerminal === undefined ||
    terminalDependencies.window.activeTerminal !== sessionTerminal ||
    sessionTerminal.name === tabName
  )
    return;

  yield* Effect.withTracerEnabled(renameActiveTerminal(terminalDependencies.commands, tabName), true);
});

// A tab does not say which terminal it holds, so the active terminal and its name on the tab stand in for that.
const findSessionTabInFront = Effect.fn("TerminalInfraService.findSessionTabInFront")(function* (
  terminalDependencies: TerminalDependencies,
  sessionTerminal: Terminal
) {
  const activeTab = terminalDependencies.window.tabGroups.activeTabGroup.activeTab;
  if (
    activeTab === undefined ||
    !(activeTab.input instanceof terminalDependencies.TabInputTerminal) ||
    activeTab.label !== sessionTerminal.name ||
    terminalDependencies.window.activeTerminal !== sessionTerminal
  )
    return yield* SessionTabNotInFrontError.make();

  return activeTab;
});

// VS Code pins only the tab in front, which a tab becomes a moment after it is shown.
export const pinSessionTab = Effect.fn("TerminalInfraService.pinSessionTab")(
  function* (terminalDependencies: TerminalDependencies, sessionTerminal: Terminal) {
    const sessionTab = yield* Effect.retry(findSessionTabInFront(terminalDependencies, sessionTerminal), {
      schedule: Schedule.spaced(SESSION_TAB_PIN_WAIT.POLL_INTERVAL_MS),
      times: SESSION_TAB_PIN_WAIT.TIMEOUT_MS / SESSION_TAB_PIN_WAIT.POLL_INTERVAL_MS
    });
    if (sessionTab.isPinned) return;

    yield* Effect.promise(() => terminalDependencies.commands.executeCommand(VS_CODE_COMMANDS.PIN_ACTIVE_EDITOR));
  },
  Effect.catchTag("SessionTabNotInFrontError", () => Effect.void)
);
