import {getDatabaseFilePath} from "@infraUtils/database.utils.ts";
import {getTmuxSocketPath} from "@infraUtils/tmuxSocket.utils.ts";
import {
  ITmuxInfraService,
  PtyBinaryNotFoundError,
  TmuxUnavailableError
} from "@interfaces/tmux.infraService.interface.ts";
import {PLATFORMS} from "@pkg/constants/src/process.constant.ts";
import {PTY_BINARY} from "@pkg/constants/src/terminal.constant.ts";
import {AGENT_START_WAIT, TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Array, Effect, Layer, Record, Result, Schedule, Schema, Stream, String, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";
import {platform} from "node:os";

import type {SessionTabCommand} from "@interfaces/terminal.infraService.interface.ts";
import type {SessionTabCommandRequest} from "@interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// What the tmux functions share: how to run tmux, what an agent runs under (aggregor-pty, when this build has it, and
// the database it writes to), and the sessions tmux was last seen running.
interface TmuxDependencies {
  readonly childProcessSpawner: ChildProcessSpawner["Service"];
  readonly databaseFilePath: string;
  readonly ptyBinaryPath: Result.Result<string, PtyBinaryNotFoundError>;
  readonly runningSessionIds: SubscriptionRef.SubscriptionRef<ReadonlySet<EntityIdValueObject>>;
  readonly tmuxConfigPath: string;
  readonly tmuxSocketPath: string;
  readonly window: VsCodeApi["Service"]["window"];
}

// tmux doesn't list the session's tmux session yet.
class SessionAgentNotListedError extends Schema.TaggedError<
  SessionAgentNotListedError,
  {readonly brand: unique symbol}
>()("SessionAgentNotListedError", {}) {}

const runTmuxCommand = Effect.fn("TmuxInfraService.runTmuxCommand")(function* (
  {childProcessSpawner, tmuxSocketPath}: Pick<TmuxDependencies, "childProcessSpawner" | "tmuxSocketPath">,
  tmuxArguments: readonly string[]
) {
  return yield* childProcessSpawner.lines(ChildProcess.make(TMUX.COMMAND, ["-S", tmuxSocketPath, ...tmuxArguments]));
});

// The version tmux reports. A build without a version number, such as "tmux master", is taken as new enough.
const checkTmuxVersion = Effect.fn("TmuxInfraService.checkTmuxVersion")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"]
) {
  const versionLines = yield* Effect.mapError(childProcessSpawner.lines(ChildProcess.make(TMUX.COMMAND, ["-V"])), () =>
    TmuxUnavailableError.make({})
  );
  const [foundVersion = ""] = versionLines;
  if (!String.startsWith(TMUX.VERSION_PREFIX)(foundVersion)) return yield* TmuxUnavailableError.make({});
  const versionNumber = Result.fromOption(String.match(TMUX.VERSION_NUMBER_PATTERN)(foundVersion), () => undefined);
  if (Result.isFailure(versionNumber)) return foundVersion;
  const {major = "0", minor = "0"} = versionNumber.success.groups === undefined ? {} : versionNumber.success.groups;
  const isTooOld =
    Number(major) < TMUX.MINIMUM_VERSION.MAJOR ||
    (Number(major) === TMUX.MINIMUM_VERSION.MAJOR && Number(minor) < TMUX.MINIMUM_VERSION.MINOR);
  if (isTooOld) return yield* TmuxUnavailableError.make({foundVersion});

  return foundVersion;
});

// No tmux, or no server yet, runs nothing.
const readRunningSessionIds = Effect.fn("TmuxInfraService.readRunningSessionIds")(function* (
  tmuxServer: Pick<TmuxDependencies, "childProcessSpawner" | "tmuxSocketPath">
) {
  const sessionNames = yield* Effect.orElseSucceed(
    runTmuxCommand(tmuxServer, ["list-sessions", "-F", "#{session_name}"]),
    (): readonly string[] => []
  );
  const runningSessionIds: ReadonlySet<EntityIdValueObject> = new Set(
    Array.getSuccesses(Array.map(sessionNames, (sessionName) => decodeEntityId(sessionName)))
  );

  return runningSessionIds;
});

const refreshRunningSessionIds = Effect.fn("TmuxInfraService.refreshRunningSessionIds")(function* (
  tmuxDependencies: TmuxDependencies
) {
  return yield* SubscriptionRef.modifyEffect(tmuxDependencies.runningSessionIds, () =>
    Effect.map(
      readRunningSessionIds(tmuxDependencies),
      (runningSessionIds) => [runningSessionIds, runningSessionIds] as const
    )
  );
});

// -A attaches to the session's tmux session when it runs, and otherwise starts it with the agent's variables.
const prepareTmuxArguments = Effect.fn("TmuxInfraService.prepareTmuxArguments")(function* (
  {tmuxConfigPath, tmuxSocketPath}: TmuxDependencies,
  {launchPlan, projectPath, sessionId}: SessionTabCommandRequest
) {
  const environmentFlags = Array.flatMap(Record.toEntries(launchPlan.environmentVariables), ([name, value]) => [
    "-e",
    `${name}=${value}`
  ]);

  return [
    ...["-S", tmuxSocketPath, "-f", tmuxConfigPath, "-u", "new-session", "-A", "-s", sessionId],
    ...environmentFlags,
    ...["-c", projectPath]
  ];
});

// aggregor-pty runs the agent and records its status on the session's row.
const preparePtyArguments = Effect.fn("TmuxInfraService.preparePtyArguments")(function* (
  {databaseFilePath}: TmuxDependencies,
  ptyBinaryPath: string,
  {launchPlan, sessionId}: SessionTabCommandRequest
) {
  return [
    ...[ptyBinaryPath, "--database", databaseFilePath, "--session", sessionId, "--"],
    ...[launchPlan.command, ...launchPlan.commandArguments]
  ];
});

// The tab runs tmux itself, so it is attached from the moment the agent starts: tmux answers an agent's question about
// the terminal's colours only through an attached client.
const prepareSessionTabCommand = Effect.fn("TmuxInfraService.prepareSessionTabCommand")(function* (
  tmuxDependencies: TmuxDependencies,
  sessionTabCommandRequest: SessionTabCommandRequest
) {
  yield* checkTmuxVersion(tmuxDependencies.childProcessSpawner);
  const ptyBinaryPath = yield* Effect.fromResult(tmuxDependencies.ptyBinaryPath);
  const sessionTabCommand: SessionTabCommand = {
    command: TMUX.COMMAND,
    commandArguments: [
      ...(yield* prepareTmuxArguments(tmuxDependencies, sessionTabCommandRequest)),
      "--",
      ...(yield* preparePtyArguments(tmuxDependencies, ptyBinaryPath, sessionTabCommandRequest))
    ]
  };

  return sessionTabCommand;
});

const confirmSessionAgentListed = Effect.fn("TmuxInfraService.confirmSessionAgentListed")(function* (
  tmuxDependencies: TmuxDependencies,
  sessionId: EntityIdValueObject
) {
  const runningSessionIds = yield* refreshRunningSessionIds(tmuxDependencies);
  if (!runningSessionIds.has(sessionId)) return yield* SessionAgentNotListedError.make();

  return runningSessionIds;
});

// The tab starts the session's tmux session a moment after it opens. One that never shows up has its tab say why.
const waitForSessionAgentStart = Effect.fn("TmuxInfraService.waitForSessionAgentStart")(
  function* (tmuxDependencies: TmuxDependencies, sessionId: EntityIdValueObject) {
    yield* Effect.retry(confirmSessionAgentListed(tmuxDependencies, sessionId), {
      schedule: Schedule.spaced(AGENT_START_WAIT.POLL_INTERVAL_MS),
      times: AGENT_START_WAIT.TIMEOUT_MS / AGENT_START_WAIT.POLL_INTERVAL_MS
    });
  },
  Effect.catchTag("SessionAgentNotListedError", () => Effect.void)
);

const killTmuxSession = Effect.fn("TmuxInfraService.killTmuxSession")(function* (
  tmuxDependencies: TmuxDependencies,
  sessionId: EntityIdValueObject
) {
  yield* Effect.ignore(runTmuxCommand(tmuxDependencies, ["kill-session", "-t", `=${sessionId}`]));

  return yield* readRunningSessionIds(tmuxDependencies);
});

const stopSessionAgent = Effect.fn("TmuxInfraService.stopSessionAgent")(function* (
  tmuxDependencies: TmuxDependencies,
  sessionId: EntityIdValueObject
) {
  yield* SubscriptionRef.modifyEffect(tmuxDependencies.runningSessionIds, () =>
    Effect.map(
      killTmuxSession(tmuxDependencies, sessionId),
      (remainingSessionIds) => [undefined, remainingSessionIds] as const
    )
  );
});

// Compares each set of running agents with the one before; the first set counts every agent as started.
const watchStartedOrStoppedSessionIds = Effect.fn("TmuxInfraService.watchStartedOrStoppedSessionIds")(function* (
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

// An agent can end, or tmux be killed, while the window is away, so coming back reads tmux's list again. A terminal
// closing does too: a tab whose tmux session ended closes with it.
const watchTmuxChangeHints = Effect.fn("TmuxInfraService.watchTmuxChangeHints")(function* (
  tmuxDependencies: TmuxDependencies
) {
  const {window} = tmuxDependencies;
  const windowStateChanges = yield* streamVsCodeEvent(window.onDidChangeWindowState);
  const closedTerminals = yield* streamVsCodeEvent(window.onDidCloseTerminal);
  const tmuxChangeHints = Stream.merge(
    Stream.filter(windowStateChanges, (windowState) => windowState.focused),
    closedTerminals
  );

  yield* Stream.runForEach(tmuxChangeHints, () =>
    Effect.withTracerEnabled(refreshRunningSessionIds(tmuxDependencies), false)
  );
});

// Linux and macOS VSIXs carry aggregor-pty; the universal one, for every other platform, does not. A failed check counts
// as missing, so the user hears why no session starts.
const findPtyBinaryPath = Effect.fn("TmuxInfraService.findPtyBinaryPath")(function* (ptyBinaryPath: string) {
  const fileSystem = yield* FileSystem;
  const isPtyBinaryFound = yield* Effect.orElseSucceed(fileSystem.exists(ptyBinaryPath), () => false);
  if (!isPtyBinaryFound) return yield* PtyBinaryNotFoundError.make({isWindows: platform() === PLATFORMS.WINDOWS});

  return ptyBinaryPath;
});

const makeTmuxDependencies = Effect.fn("TmuxInfraService.makeTmuxDependencies")(function* () {
  const {extensionUri, Uri, window} = yield* VsCodeApi;
  const childProcessSpawner = yield* ChildProcessSpawner;
  const ptyBinaryPath = Uri.joinPath(extensionUri, PTY_BINARY).fsPath;
  const tmuxSocketPath = yield* getTmuxSocketPath();
  const initialSessionIds = yield* readRunningSessionIds({childProcessSpawner, tmuxSocketPath});
  const tmuxDependencies: TmuxDependencies = {
    childProcessSpawner,
    databaseFilePath: yield* getDatabaseFilePath(),
    ptyBinaryPath: yield* Effect.result(findPtyBinaryPath(ptyBinaryPath)),
    runningSessionIds: yield* SubscriptionRef.make(initialSessionIds),
    tmuxConfigPath: Uri.joinPath(extensionUri, TMUX.CONFIG_FILE).fsPath,
    tmuxSocketPath,
    window
  };

  return tmuxDependencies;
});

// A server already running keeps the config it started with, so this window's tmux.conf is read into it again.
const makeTmuxInfraService = Effect.fn("TmuxInfraService.make")(function* () {
  const tmuxDependencies = yield* makeTmuxDependencies();
  const {runningSessionIds, tmuxConfigPath} = tmuxDependencies;
  const initialSessionIds = yield* SubscriptionRef.get(runningSessionIds);
  if (initialSessionIds.size > 0)
    yield* Effect.ignore(runTmuxCommand(tmuxDependencies, ["source-file", tmuxConfigPath]));
  yield* Effect.forkScoped(watchTmuxChangeHints(tmuxDependencies));

  return {
    prepareSessionTabCommand: (sessionTabCommandRequest: SessionTabCommandRequest) =>
      prepareSessionTabCommand(tmuxDependencies, sessionTabCommandRequest),
    refreshRunningSessionIds: refreshRunningSessionIds(tmuxDependencies),
    runningSessionIds,
    startedOrStoppedSessionIds: yield* watchStartedOrStoppedSessionIds(runningSessionIds),
    stopSessionAgent: (sessionId: EntityIdValueObject) => stopSessionAgent(tmuxDependencies, sessionId),
    waitForSessionAgentStart: (sessionId: EntityIdValueObject) => waitForSessionAgentStart(tmuxDependencies, sessionId)
  };
});

export const TmuxInfraService = Layer.effect(ITmuxInfraService, makeTmuxInfraService());
