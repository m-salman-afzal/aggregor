import {SESSION_ID_ENV} from "@pkg/constants/src/extension.constant.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Ref, Schema, Stream, SubscriptionRef} from "effect";

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

const TITLE_READ_INTERVAL = "1 second";

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

// The titles that changed since the last read. Each is the raw title the agent set, since VS Code stops taking it from
// the terminal only for a tab that has a name.
const findChangedTitles = Effect.fn("TerminalInfraService.findChangedTitles")(function* (
  sessionTerminals: SessionTerminalsReference,
  readTitles: Ref.Ref<ReadonlyMap<EntityIdValueObject, string>>
) {
  const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
  const currentTitles: ReadonlyMap<EntityIdValueObject, string> = new Map(
    Array.map([...openTerminals], ([sessionId, terminal]) => [sessionId, terminal.name] as const)
  );
  const previousTitles = yield* Ref.getAndSet(readTitles, currentTitles);

  return Array.filter([...currentTitles], ([sessionId, title]) => previousTitles.get(sessionId) !== title);
});

// VS Code has no event for a terminal's title changing, so each tab's is read every second, untraced like the spinner.
// Each subscriber keeps its own last-read titles, so one cannot take another's changes.
export const watchSessionTerminalTitles = Effect.fn("TerminalInfraService.watchSessionTerminalTitles")(function* (
  sessionTerminals: SessionTerminalsReference
) {
  return Stream.unwrap(
    Effect.map(Ref.make<ReadonlyMap<EntityIdValueObject, string>>(new Map()), (readTitles) =>
      Stream.flatMap(Stream.tick(TITLE_READ_INTERVAL), () =>
        Stream.fromIterableEffect(Effect.withTracerEnabled(findChangedTitles(sessionTerminals, readTitles), false))
      )
    )
  );
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
