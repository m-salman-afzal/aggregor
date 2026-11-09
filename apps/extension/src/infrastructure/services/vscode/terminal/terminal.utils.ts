import {PtyBinaryNotFoundError} from "@interfaces/terminal.infraService.interface.ts";
import {SESSION_ID_ENV} from "@pkg/constants/src/terminal.constant.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Schema, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {platform} from "node:os";

import type {
  SessionTerminalsReference,
  TerminalDependencies
} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
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
const renameActiveTerminal = Effect.fn("TerminalInfraService.renameActiveTerminal")(function* (
  commands: TerminalDependencies["commands"],
  tabName: string
) {
  yield* Effect.promise(() => commands.executeCommand("workbench.action.terminal.renameWithArg", {name: tabName}));
});

// VS Code renames only the active terminal, so a tab in the background keeps its name until it comes to the front. A
// rename shows in the trace; the check before it runs on every write to a session, untraced.
export const nameActiveSessionTab = Effect.fn("TerminalInfraService.nameActiveSessionTab")(function* (
  {commands, sessionTerminals, window}: TerminalDependencies,
  sessionId: EntityIdValueObject,
  tabName: string
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
  const sessionTerminal = openTerminals.get(sessionId);
  if (sessionTerminal === undefined || window.activeTerminal !== sessionTerminal || sessionTerminal.name === tabName)
    return;

  yield* Effect.withTracerEnabled(renameActiveTerminal(commands, tabName), true);
});

// Compares each set of open tabs with the one before; the first set counts every tab as opened.
export const watchOpenedOrClosedSessionIds = Effect.fn("TerminalInfraService.watchOpenedOrClosedSessionIds")(function* (
  sessionTerminals: SessionTerminalsReference
) {
  return Stream.mapAccum(
    SubscriptionRef.changes(sessionTerminals),
    (): ReadonlySet<EntityIdValueObject> => new Set(),
    (previousSessionIds, openTerminals) => {
      const openSessionIds: ReadonlySet<EntityIdValueObject> = new Set(openTerminals.keys());
      const changedSessionIds = [
        ...Array.filter([...openSessionIds], (sessionId) => !previousSessionIds.has(sessionId)),
        ...Array.filter([...previousSessionIds], (sessionId) => !openSessionIds.has(sessionId))
      ];

      return [openSessionIds, changedSessionIds] as const;
    }
  );
});
