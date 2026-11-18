import {
  checkTmuxVersion,
  escapeTmuxFormat,
  killTmuxSession,
  listTmuxClients,
  listTmuxSessionNames,
  prepareOwnScopeArguments,
  prepareTerminalCommand,
  switchTmuxClient
} from "@infraServices/tmux/tmuxServer.utils.ts";
import {PtyBinaryNotFoundError, SessionTabSwitchFailedError} from "@interfaces/tmux.infraService.interface.ts";
import {PLATFORMS} from "@pkg/constants/src/process.constant.ts";
import {AGENT_START_WAIT, TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Record, Result, Schedule, Schema, Stream, String, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {platform} from "node:os";

import type {TmuxDependencies, TmuxServer} from "@infraServices/tmux/tmux.infraService.type.ts";
import type {SessionTabCommandRequest} from "@interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

class SessionAgentNotListedError extends Schema.TaggedError<
  SessionAgentNotListedError,
  {readonly brand: unique symbol}
>()("SessionAgentNotListedError", {}) {}

// An agent's tmux session is named by its session's id; a folder's shell, whose name is no id, is none.
export const readRunningSessionIds = Effect.fn("TmuxInfraService.readRunningSessionIds")(function* (
  tmuxServer: TmuxServer
) {
  const sessionNames = yield* listTmuxSessionNames(tmuxServer);
  const runningSessionIds: ReadonlySet<EntityIdValueObject> = new Set(
    Array.getSuccesses(Array.map(sessionNames, (sessionName) => decodeEntityId(sessionName)))
  );

  return runningSessionIds;
});

export const refreshRunningSessionIds = Effect.fn("TmuxInfraService.refreshRunningSessionIds")(function* (
  tmuxDependencies: TmuxDependencies
) {
  return yield* SubscriptionRef.modifyEffect(tmuxDependencies.runningSessionIds, () =>
    Effect.map(
      readRunningSessionIds(tmuxDependencies),
      (runningSessionIds) => [runningSessionIds, runningSessionIds] as const
    )
  );
});

export const readShownSessionIdsByTabProcessId = Effect.fn("TmuxInfraService.readShownSessionIdsByTabProcessId")(
  function* (tmuxServer: TmuxServer) {
    const tmuxClients = yield* listTmuxClients(tmuxServer);
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

export const showSessionInTab = Effect.fn("TmuxInfraService.showSessionInTab")(function* (
  tmuxServer: TmuxServer,
  tabProcessId: number,
  sessionId: EntityIdValueObject
) {
  yield* Effect.mapError(switchTmuxClient(tmuxServer, tabProcessId, sessionId), () =>
    SessionTabSwitchFailedError.make({sessionId})
  );
});

// -A attaches to the session's tmux session when it runs, and otherwise starts it.
const prepareSessionTmuxArguments = Effect.fn("TmuxInfraService.prepareSessionTmuxArguments")(function* (
  sessionTabCommandRequest: SessionTabCommandRequest
) {
  const environmentFlags = Array.flatMap(
    Record.toEntries(sessionTabCommandRequest.launchPlan.environmentVariables),
    ([name, value]) => ["-e", `${name}=${value}`]
  );

  return [
    ...["new-session", "-A", "-s", sessionTabCommandRequest.sessionId],
    ...environmentFlags,
    ...["-c", yield* escapeTmuxFormat(sessionTabCommandRequest.workingFolderPath)]
  ];
});

const preparePtyArguments = Effect.fn("TmuxInfraService.preparePtyArguments")(function* (
  tmuxDependencies: TmuxDependencies,
  ptyBinaryPath: string,
  sessionTabCommandRequest: SessionTabCommandRequest
) {
  return [
    ...[
      ptyBinaryPath,
      "--database",
      tmuxDependencies.databaseFilePath,
      "--session",
      sessionTabCommandRequest.sessionId,
      "--"
    ],
    ...[sessionTabCommandRequest.launchPlan.command, ...sessionTabCommandRequest.launchPlan.commandArguments]
  ];
});

// The script's output stays in the tab above the agent's, and the agent starts whether or not the script succeeds.
const prepareSetupArguments = Effect.fn("TmuxInfraService.prepareSetupArguments")(function* (
  sessionTabCommandRequest: SessionTabCommandRequest
) {
  const setupScript = sessionTabCommandRequest.setupScript;
  if (setupScript === undefined || String.trim(setupScript) === "") return [];

  return [TMUX.SETUP_SHELL, "-c", `${setupScript}\nexec "$@"`, TMUX.SETUP_SHELL];
});

// The tab runs tmux itself: tmux answers an agent's query about the terminal's colours only through an attached client.
export const prepareSessionTabCommand = Effect.fn("TmuxInfraService.prepareSessionTabCommand")(function* (
  tmuxDependencies: TmuxDependencies,
  sessionTabCommandRequest: SessionTabCommandRequest
) {
  yield* checkTmuxVersion(tmuxDependencies.childProcessSpawner);
  const ptyBinaryPath = yield* Effect.fromResult(tmuxDependencies.ptyBinaryPath);

  // The setup script runs inside the agent's scope too, since it can start memory-hungry installs.
  return yield* prepareTerminalCommand(tmuxDependencies, [
    ...(yield* prepareSessionTmuxArguments(sessionTabCommandRequest)),
    "--",
    ...(yield* prepareOwnScopeArguments(tmuxDependencies, sessionTabCommandRequest.sessionMemoryLimit)),
    ...(yield* prepareSetupArguments(sessionTabCommandRequest)),
    ...(yield* preparePtyArguments(tmuxDependencies, ptyBinaryPath, sessionTabCommandRequest))
  ]);
});

const confirmSessionAgentListed = Effect.fn("TmuxInfraService.confirmSessionAgentListed")(function* (
  tmuxDependencies: TmuxDependencies,
  sessionId: EntityIdValueObject
) {
  const runningSessionIds = yield* refreshRunningSessionIds(tmuxDependencies);
  if (!runningSessionIds.has(sessionId)) return yield* SessionAgentNotListedError.make();

  return runningSessionIds;
});

// The tab starts the session's tmux session a moment after it opens.
export const waitForSessionAgentStart = Effect.fn("TmuxInfraService.waitForSessionAgentStart")(
  function* (tmuxDependencies: TmuxDependencies, sessionId: EntityIdValueObject) {
    yield* Effect.retry(confirmSessionAgentListed(tmuxDependencies, sessionId), {
      schedule: Schedule.spaced(AGENT_START_WAIT.POLL_INTERVAL_MS),
      times: AGENT_START_WAIT.TIMEOUT_MS / AGENT_START_WAIT.POLL_INTERVAL_MS
    });
  },
  Effect.catchTag("SessionAgentNotListedError", () => Effect.void)
);

const killSessionAgent = Effect.fn("TmuxInfraService.killSessionAgent")(function* (
  tmuxServer: TmuxServer,
  sessionId: EntityIdValueObject
) {
  yield* killTmuxSession(tmuxServer, sessionId);

  return yield* readRunningSessionIds(tmuxServer);
});

export const stopSessionAgent = Effect.fn("TmuxInfraService.stopSessionAgent")(function* (
  tmuxDependencies: TmuxDependencies,
  sessionId: EntityIdValueObject
) {
  yield* SubscriptionRef.modifyEffect(tmuxDependencies.runningSessionIds, () =>
    Effect.map(
      killSessionAgent(tmuxDependencies, sessionId),
      (remainingSessionIds) => [undefined, remainingSessionIds] as const
    )
  );
});

// The first set counts every agent as started.
export const watchStartedOrStoppedSessionIds = Effect.fn("TmuxInfraService.watchStartedOrStoppedSessionIds")(function* (
  runningSessionIds: TmuxDependencies["runningSessionIds"]
) {
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
});

// Windows VSIXs carry no aggregor-pty; a failed check counts as missing, so the user hears why no session starts.
export const findPtyBinaryPath = Effect.fn("TmuxInfraService.findPtyBinaryPath")(function* (ptyBinaryPath: string) {
  const fileSystem = yield* FileSystem;
  const isPtyBinaryFound = yield* Effect.orElseSucceed(fileSystem.exists(ptyBinaryPath), () => false);
  if (!isPtyBinaryFound) return yield* PtyBinaryNotFoundError.make({isWindows: platform() === PLATFORMS.WINDOWS});

  return ptyBinaryPath;
});
