import {Array, Context, Effect, Layer, Result, Schedule, SubscriptionRef} from "effect";

import {decodeEntityId} from "@/valueObjects/entityId.valueObject.ts";
import {SESSION_ID_ENV, SESSION_TAB_PIN_WAIT} from "@pkg/constants/src/terminal.constant.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";

import type {Terminal} from "vscode";

import type {EntityIdValueObject} from "@/valueObjects/entityId.valueObject.ts";

class TerminalUtilsErrors extends TaggedErrors({
  SessionTabNotInFrontError: {},
  UntrackedTerminalError: {}
}) {}

export class TerminalUtils extends Context.Service<TerminalUtils>()(
  "aggregor-app/infrastructure/services/vscode/terminal/terminal.utils/TerminalUtils",
  {
    make: Effect.fn("TerminalUtils.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;

      const readTerminalEnvironmentVariable = Effect.fn("TerminalUtils.readTerminalEnvironmentVariable")(function* (
        terminal: Terminal | undefined,
        variableName: string
      ) {
        if (terminal === undefined) return undefined;
        const environmentVariables = "env" in terminal.creationOptions ? terminal.creationOptions.env : undefined;

        return environmentVariables === undefined ? undefined : environmentVariables[variableName];
      });

      const readTerminalProcessId = Effect.fn("TerminalUtils.readTerminalProcessId")(function* (terminal: Terminal) {
        return yield* Effect.promise(() => terminal.processId);
      });

      // VS Code keeps the session id a tab is opened with for the tab's whole life, through an extension restart too.
      const identifySessionTerminal = Effect.fn("TerminalUtils.identifySessionTerminal")(
        function* (terminal: Terminal) {
          const sessionIdValue = yield* readTerminalEnvironmentVariable(terminal, SESSION_ID_ENV);

          return yield* Effect.fromResult(decodeEntityId(sessionIdValue));
        },
        Effect.mapError(() => TerminalUtilsErrors.UntrackedTerminalError.make())
      );

      // Session tabs outlive the extension host, which restarts when the window turns into a multi-root workspace.
      const findOpenSessionTerminals = Effect.fn("TerminalUtils.findOpenSessionTerminals")(function* (
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

      const openSessionTerminals = yield* findOpenSessionTerminals(vsCodeApi.window.terminals);
      const sessionTerminals = yield* SubscriptionRef.make(openSessionTerminals);

      const findTrackedSessionId = Effect.fn("TerminalUtils.findTrackedSessionId")(function* (terminal: Terminal) {
        const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
        const trackedEntry = Array.findFirst([...openTerminals], ([, sessionTerminal]) => sessionTerminal === terminal);

        return yield* Effect.fromResult(
          Result.map(
            Result.fromOption(trackedEntry, () => TerminalUtilsErrors.UntrackedTerminalError.make()),
            ([sessionId]) => sessionId
          )
        );
      });

      // VS Code renames only the active terminal, so the tab comes to the front first.
      const renameActiveTerminal = Effect.fn("TerminalUtils.renameActiveTerminal")(function* (tabName: string) {
        yield* Effect.promise(() =>
          vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.RENAME_ACTIVE_TERMINAL, {name: tabName})
        );
      });

      const nameActiveSessionTab = Effect.fn("TerminalUtils.nameActiveSessionTab")(function* (
        sessionId: EntityIdValueObject,
        tabName: string
      ) {
        const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
        const sessionTerminal = openTerminals.get(sessionId);
        if (
          sessionTerminal === undefined ||
          vsCodeApi.window.activeTerminal !== sessionTerminal ||
          sessionTerminal.name === tabName
        )
          return;

        yield* Effect.withTracerEnabled(renameActiveTerminal(tabName), true);
      });

      // A tab does not say which terminal it holds, so the active terminal and its name on the tab stand in for that.
      const findSessionTabInFront = Effect.fn("TerminalUtils.findSessionTabInFront")(function* (
        sessionTerminal: Terminal
      ) {
        const activeTab = vsCodeApi.window.tabGroups.activeTabGroup.activeTab;
        if (
          activeTab === undefined ||
          !(activeTab.input instanceof vsCodeApi.TabInputTerminal) ||
          activeTab.label !== sessionTerminal.name ||
          vsCodeApi.window.activeTerminal !== sessionTerminal
        )
          return yield* TerminalUtilsErrors.SessionTabNotInFrontError.make();

        return activeTab;
      });

      // VS Code pins only the tab in front, which a tab becomes a moment after it is shown.
      const pinSessionTab = Effect.fn("TerminalUtils.pinSessionTab")(
        function* (sessionTerminal: Terminal) {
          const sessionTab = yield* Effect.retry(findSessionTabInFront(sessionTerminal), {
            schedule: Schedule.spaced(SESSION_TAB_PIN_WAIT.POLL_INTERVAL_MS),
            times: SESSION_TAB_PIN_WAIT.TIMEOUT_MS / SESSION_TAB_PIN_WAIT.POLL_INTERVAL_MS
          });
          if (sessionTab.isPinned) return;

          yield* Effect.promise(() => vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.PIN_ACTIVE_EDITOR));
        },
        Effect.catchTag("SessionTabNotInFrontError", () => Effect.void)
      );

      return {
        findOpenSessionTerminals,
        findTrackedSessionId,
        nameActiveSessionTab,
        pinSessionTab,
        readTerminalEnvironmentVariable,
        readTerminalProcessId,
        sessionTerminals
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
