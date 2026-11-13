import {SESSION_ID_ENV} from "@pkg/constants/src/terminal.constant.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Result, Schema, SubscriptionRef} from "effect";

import type {
  SessionTerminalsReference,
  TerminalDependencies
} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Terminal} from "vscode";

// A terminal that is no session's tab, such as a plain shell.
class UntrackedTerminalError extends Schema.TaggedError<UntrackedTerminalError, {readonly brand: unique symbol}>()(
  "UntrackedTerminalError",
  {}
) {}

// The session id a tab is opened with, which VS Code keeps for the tab's whole life, through an extension restart too.
const identifySessionTerminal = Effect.fn("TerminalInfraService.identifySessionTerminal")(
  function* (terminal: Terminal) {
    const environmentVariables = "env" in terminal.creationOptions ? terminal.creationOptions.env : undefined;
    const sessionIdValue = environmentVariables === undefined ? undefined : environmentVariables[SESSION_ID_ENV];

    return yield* Effect.fromResult(decodeEntityId(sessionIdValue));
  },
  Effect.mapError(() => UntrackedTerminalError.make())
);

// Session tabs outlive the extension host, which restarts when the window turns into a multi-root workspace. Picking
// them up again keeps the tab and its agent paired.
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

// The session whose tab the terminal is, among the tabs this window tracks.
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

// VS Code renames only the active terminal, so the tab comes to the front first. A closed tab has nothing to rename; the
// session's next tab opens under the name.
const renameActiveTerminal = Effect.fn("TerminalInfraService.renameActiveTerminal")(function* (
  commands: TerminalDependencies["commands"],
  tabName: string
) {
  yield* Effect.promise(() => commands.executeCommand(VS_CODE_COMMANDS.RENAME_ACTIVE_TERMINAL, {name: tabName}));
});

// VS Code renames only the active terminal, so a tab in the background keeps its name until it comes to the front. A
// rename shows in the trace; the check before it runs on every write to a session, untraced.
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
