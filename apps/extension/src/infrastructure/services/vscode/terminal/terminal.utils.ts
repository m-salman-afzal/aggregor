import {PROJECT_PATH_ENV, SESSION_ID_ENV} from "@pkg/constants/src/terminal.constant.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Result, Schema, SubscriptionRef} from "effect";

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

class ProjectTerminalNotFoundError extends Schema.TaggedError<
  ProjectTerminalNotFoundError,
  {readonly brand: unique symbol}
>()("ProjectTerminalNotFoundError", {}) {}

const readTerminalEnvironmentVariable = Effect.fn("TerminalInfraService.readTerminalEnvironmentVariable")(function* (
  terminal: Terminal | undefined,
  variableName: string
) {
  if (terminal === undefined) return undefined;
  const environmentVariables = "env" in terminal.creationOptions ? terminal.creationOptions.env : undefined;

  return environmentVariables === undefined ? undefined : environmentVariables[variableName];
});

export const readTerminalProjectPath = Effect.fn("TerminalInfraService.readTerminalProjectPath")(function* (
  terminal: Terminal | undefined
) {
  return yield* readTerminalEnvironmentVariable(terminal, PROJECT_PATH_ENV);
});

export const isSessionTerminal = Effect.fn("TerminalInfraService.isSessionTerminal")(function* (terminal: Terminal) {
  const sessionIdValue = yield* readTerminalEnvironmentVariable(terminal, SESSION_ID_ENV);

  return sessionIdValue !== undefined;
});

export const findProjectTerminal = Effect.fn("TerminalInfraService.findProjectTerminal")(function* (
  terminals: readonly Terminal[],
  projectPath: string
) {
  const terminalProjectPaths = yield* Effect.forEach(terminals, (terminal) => readTerminalProjectPath(terminal));
  const projectTerminal = Array.findFirst(
    terminals,
    (terminal, terminalIndex) =>
      terminal.exitStatus === undefined && terminalProjectPaths[terminalIndex] === projectPath
  );

  return yield* Effect.fromResult(Result.fromOption(projectTerminal, () => ProjectTerminalNotFoundError.make()));
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
