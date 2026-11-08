import {PtyBinaryNotFoundError} from "@interfaces/terminal.infraService.interface.ts";
import {SESSION_ID_ENV} from "@pkg/constants/src/extension.constant.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Schema, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {platform} from "node:os";

import type {TerminalDependencies} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Terminal} from "vscode";

// A terminal without a session id in its env is not a session's.
class UntrackedTerminalError extends Schema.TaggedError<UntrackedTerminalError, {readonly brand: unique symbol}>()(
  "UntrackedTerminalError",
  {}
) {}

// Every session terminal carries its session id in its env, which VS Code keeps across extension host restarts.
export const findTerminalSessionId = Effect.fn("TerminalInfraService.findTerminalSessionId")(
  function* (terminal: Terminal) {
    const {creationOptions} = terminal;
    const environmentVariables = "env" in creationOptions ? creationOptions.env : undefined;
    const sessionIdValue = environmentVariables === undefined ? undefined : environmentVariables[SESSION_ID_ENV];

    return yield* Effect.fromResult(decodeEntityId(sessionIdValue));
  },
  Effect.mapError(() => UntrackedTerminalError.make())
);

// Session tabs keep running when the extension host restarts, as it does when the window turns into a multi-root
// workspace. Picking them up again keeps their rows running instead of resuming a second agent on their conversation.
export const findOpenSessionTerminals = Effect.fn("TerminalInfraService.findOpenSessionTerminals")(function* (
  terminals: readonly Terminal[]
) {
  const sessionTerminalResults = yield* Effect.forEach(terminals, (terminal) =>
    Effect.result(Effect.map(findTerminalSessionId(terminal), (sessionId) => [sessionId, terminal] as const))
  );
  const openSessionTerminals: ReadonlyMap<EntityIdValueObject, Terminal> = new Map(
    Array.getSuccesses(sessionTerminalResults)
  );

  return openSessionTerminals;
});

// Linux and macOS VSIXs carry aggregor-pty; the universal one, for every other platform, does not. A failed check counts
// as missing, so the user hears why no session starts.
export const findPtyBinaryPath = Effect.fn("TerminalInfraService.findPtyBinaryPath")(function* (ptyBinaryPath: string) {
  const fileSystem = yield* FileSystem;
  const isPtyBinaryFound = yield* Effect.orElseSucceed(fileSystem.exists(ptyBinaryPath), () => false);
  if (!isPtyBinaryFound) return yield* PtyBinaryNotFoundError.make({isWindows: platform() === "win32"});

  return ptyBinaryPath;
});

// VS Code renames only the active terminal, so the tab comes to the front first. A closed tab has nothing to rename; the
// session's next tab opens under the name.
export const renameSessionTerminal = Effect.fn("TerminalInfraService.renameSessionTerminal")(function* (
  {commands, sessionTerminals}: TerminalDependencies,
  sessionId: EntityIdValueObject,
  tabName: string
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
  const sessionTerminal = openTerminals.get(sessionId);
  if (sessionTerminal === undefined) return;

  yield* Effect.sync(() => {
    sessionTerminal.show();
  });
  yield* Effect.promise(() => commands.executeCommand("workbench.action.terminal.renameWithArg", {name: tabName}));
});
