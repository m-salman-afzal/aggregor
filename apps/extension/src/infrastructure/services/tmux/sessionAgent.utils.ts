import {platform} from "node:os";

import {NodeServices} from "@effect/platform-node";
import {Array, Context, Effect, Layer, Record, Result, Schedule, Stream, String, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";

import {TmuxServerUtils} from "@/infraServices/tmux/tmuxServer.utils.ts";
import {DatabaseUtils} from "@/infraUtils/database.utils.ts";
import {ITmuxInfraServiceErrors} from "@/interfaces/tmux.infraService.interface.ts";
import {decodeEntityId} from "@/valueObjects/entityId.valueObject.ts";
import {PLATFORMS} from "@pkg/constants/src/process.constant.ts";
import {PTY_BINARY} from "@pkg/constants/src/terminal.constant.ts";
import {AGENT_START_WAIT, TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";

import type {SessionTabCommandRequest} from "@/interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@/valueObjects/entityId.valueObject.ts";

class SessionAgentUtilsErrors extends TaggedErrors({
  SessionAgentNotListedError: {}
}) {}

export class SessionAgentUtils extends Context.Service<SessionAgentUtils>()(
  "aggregor-app/infrastructure/services/tmux/sessionAgent.utils/SessionAgentUtils",
  {
    make: Effect.fn("SessionAgentUtils.make")(function* () {
      const fileSystem = yield* FileSystem;
      const vsCodeApi = yield* VsCodeApi;
      const databaseUtils = yield* DatabaseUtils;
      const tmuxServerUtils = yield* TmuxServerUtils;

      // An agent's tmux session is named by its session's id; a folder's shell, whose name is no id, is none.
      const readRunningSessionIds = Effect.fn("SessionAgentUtils.readRunningSessionIds")(function* () {
        const sessionNames = yield* tmuxServerUtils.listTmuxSessionNames;
        const runningSessionIds: ReadonlySet<EntityIdValueObject> = new Set(
          Array.getSuccesses(Array.map(sessionNames, (sessionName) => decodeEntityId(sessionName)))
        );

        return runningSessionIds;
      });

      // Windows VSIXs carry no aggregor-pty.
      const findPtyBinaryPath = Effect.fn("SessionAgentUtils.findPtyBinaryPath")(function* (ptyBinaryPath: string) {
        const isPtyBinaryFound = yield* Effect.orElseSucceed(fileSystem.exists(ptyBinaryPath), () => false);
        if (!isPtyBinaryFound)
          return yield* ITmuxInfraServiceErrors.PtyBinaryNotFoundError.make({
            isWindows: platform() === PLATFORMS.WINDOWS
          });

        return ptyBinaryPath;
      });

      const initialSessionIds = yield* readRunningSessionIds();
      const runningSessionIds = yield* SubscriptionRef.make(initialSessionIds);
      const databaseFilePath = yield* databaseUtils.getDatabaseFilePath;
      const foundPtyBinaryPath = yield* Effect.result(
        findPtyBinaryPath(vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, PTY_BINARY).fsPath)
      );

      const refreshRunningSessionIds = Effect.fn("SessionAgentUtils.refreshRunningSessionIds")(function* () {
        return yield* SubscriptionRef.modifyEffect(runningSessionIds, () =>
          Effect.map(readRunningSessionIds(), (listedSessionIds) => [listedSessionIds, listedSessionIds] as const)
        );
      });

      const readShownSessionIdsByTabProcessId = Effect.fn("SessionAgentUtils.readShownSessionIdsByTabProcessId")(
        function* () {
          const tmuxClients = yield* tmuxServerUtils.listTmuxClients;
          const shownSessionIdsByTabProcessId: ReadonlyMap<number, EntityIdValueObject> = new Map(
            Array.getSuccesses(
              Array.map(tmuxClients, (tmuxClient) =>
                Result.map(
                  decodeEntityId(tmuxClient.sessionName),
                  (sessionId) => [tmuxClient.terminalProcessId, sessionId] as const
                )
              )
            )
          );

          return shownSessionIdsByTabProcessId;
        }
      );

      const showSessionInTab = Effect.fn("SessionAgentUtils.showSessionInTab")(function* (
        tabProcessId: number,
        sessionId: EntityIdValueObject
      ) {
        yield* Effect.mapError(tmuxServerUtils.switchTmuxClient(tabProcessId, sessionId), () =>
          ITmuxInfraServiceErrors.SessionTabSwitchFailedError.make({sessionId})
        );
      });

      // -A attaches to the session's tmux session when it runs, and otherwise starts it.
      const prepareSessionTmuxArguments = Effect.fn("SessionAgentUtils.prepareSessionTmuxArguments")(function* (
        sessionTabCommandRequest: SessionTabCommandRequest
      ) {
        const environmentFlags = Array.flatMap(
          Record.toEntries(sessionTabCommandRequest.launchPlan.environmentVariables),
          ([name, value]) => ["-e", `${name}=${value}`]
        );

        return [
          ...["new-session", "-A", "-s", sessionTabCommandRequest.sessionId],
          ...environmentFlags,
          ...["-c", yield* tmuxServerUtils.escapeTmuxFormat(sessionTabCommandRequest.workingFolderPath)]
        ];
      });

      const preparePtyArguments = Effect.fn("SessionAgentUtils.preparePtyArguments")(function* (
        ptyBinaryPath: string,
        sessionTabCommandRequest: SessionTabCommandRequest
      ) {
        return [
          ...[ptyBinaryPath, "--database", databaseFilePath, "--session", sessionTabCommandRequest.sessionId, "--"],
          ...[sessionTabCommandRequest.launchPlan.command, ...sessionTabCommandRequest.launchPlan.commandArguments]
        ];
      });

      // The script's output stays in the tab above the agent's, and the agent starts whether or not the script succeeds.
      const prepareSetupArguments = Effect.fn("SessionAgentUtils.prepareSetupArguments")(function* (
        sessionTabCommandRequest: SessionTabCommandRequest
      ) {
        const setupScript = sessionTabCommandRequest.setupScript;
        if (setupScript === undefined || String.trim(setupScript) === "") return [];

        return [TMUX.SETUP_SHELL, "-c", `${setupScript}\nexec "$@"`, TMUX.SETUP_SHELL];
      });

      // The tab runs tmux itself: tmux answers an agent's query about the terminal's colours only through an attached client.
      const prepareSessionTabCommand = Effect.fn("SessionAgentUtils.prepareSessionTabCommand")(function* (
        sessionTabCommandRequest: SessionTabCommandRequest
      ) {
        yield* tmuxServerUtils.checkTmuxVersion;
        const ptyBinaryPath = yield* Effect.fromResult(foundPtyBinaryPath);

        // The setup script runs inside the agent's scope too, since it can start memory-hungry installs.
        return yield* tmuxServerUtils.prepareTerminalCommand([
          ...(yield* prepareSessionTmuxArguments(sessionTabCommandRequest)),
          "--",
          ...(yield* tmuxServerUtils.prepareOwnScopeArguments(sessionTabCommandRequest.sessionMemoryLimit)),
          ...(yield* prepareSetupArguments(sessionTabCommandRequest)),
          ...(yield* preparePtyArguments(ptyBinaryPath, sessionTabCommandRequest))
        ]);
      });

      const confirmSessionAgentListed = Effect.fn("SessionAgentUtils.confirmSessionAgentListed")(function* (
        sessionId: EntityIdValueObject
      ) {
        const refreshedSessionIds = yield* refreshRunningSessionIds();
        if (!refreshedSessionIds.has(sessionId))
          return yield* SessionAgentUtilsErrors.SessionAgentNotListedError.make();

        return refreshedSessionIds;
      });

      // The tab starts the session's tmux session a moment after it opens.
      const waitForSessionAgentStart = Effect.fn("SessionAgentUtils.waitForSessionAgentStart")(
        function* (sessionId: EntityIdValueObject) {
          yield* Effect.retry(confirmSessionAgentListed(sessionId), {
            schedule: Schedule.spaced(AGENT_START_WAIT.POLL_INTERVAL_MS),
            times: AGENT_START_WAIT.TIMEOUT_MS / AGENT_START_WAIT.POLL_INTERVAL_MS
          });
        },
        Effect.catchTag("SessionAgentNotListedError", () => Effect.void)
      );

      const pasteTextIntoSessionAgent = Effect.fn("SessionAgentUtils.pasteTextIntoSessionAgent")(function* (
        sessionId: EntityIdValueObject,
        text: string
      ) {
        yield* Effect.mapError(tmuxServerUtils.pasteTextIntoTmuxSession(sessionId, text), () =>
          ITmuxInfraServiceErrors.TmuxSessionNotRunningError.make()
        );
      });

      const killSessionAgent = Effect.fn("SessionAgentUtils.killSessionAgent")(function* (
        sessionId: EntityIdValueObject
      ) {
        yield* tmuxServerUtils.killTmuxSession(sessionId);

        return yield* readRunningSessionIds();
      });

      const stopSessionAgent = Effect.fn("SessionAgentUtils.stopSessionAgent")(function* (
        sessionId: EntityIdValueObject
      ) {
        yield* SubscriptionRef.modifyEffect(runningSessionIds, () =>
          Effect.map(killSessionAgent(sessionId), (remainingSessionIds) => [undefined, remainingSessionIds] as const)
        );
      });

      const watchStartedOrStoppedSessionIds = Effect.fn("SessionAgentUtils.watchStartedOrStoppedSessionIds")(
        function* () {
          return Stream.mapAccum(
            SubscriptionRef.changes(runningSessionIds),
            (): ReadonlySet<EntityIdValueObject> => new Set(),
            (previousSessionIds, currentSessionIds) => {
              const changedSessionIds = [
                ...Array.filter([...currentSessionIds], (sessionId) => !previousSessionIds.has(sessionId)),
                ...Array.filter([...previousSessionIds], (sessionId) => !currentSessionIds.has(sessionId))
              ];

              return [currentSessionIds, changedSessionIds] as const;
            }
          );
        }
      );

      return {
        findPtyBinaryPath,
        pasteTextIntoSessionAgent,
        prepareSessionTabCommand,
        readRunningSessionIds: readRunningSessionIds(),
        readShownSessionIdsByTabProcessId: readShownSessionIdsByTabProcessId(),
        refreshRunningSessionIds: refreshRunningSessionIds(),
        runningSessionIds,
        showSessionInTab,
        stopSessionAgent,
        waitForSessionAgentStart,
        watchStartedOrStoppedSessionIds: watchStartedOrStoppedSessionIds()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([DatabaseUtils.layer, TmuxServerUtils.layer, NodeServices.layer])
  );
}
