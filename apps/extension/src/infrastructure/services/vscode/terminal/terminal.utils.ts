import {SESSION_ID_ENV} from "@pkg/constants/src/extension.constant.ts";
import {decodeSessionId} from "@valueObjects/sessionId.valueObject.ts";
import {Array, Effect, Schema} from "effect";

import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
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

    return yield* Effect.fromResult(decodeSessionId(sessionIdValue));
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
  const openSessionTerminals: ReadonlyMap<SessionIdValueObject, Terminal> = new Map(
    Array.getSuccesses(sessionTerminalResults)
  );

  return openSessionTerminals;
});
