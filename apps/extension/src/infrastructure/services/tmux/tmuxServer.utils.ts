import {TmuxUnavailableError} from "@interfaces/tmux.infraService.interface.ts";
import {SYSTEMD_SCOPE, TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {Array, Effect, Result, Schema, String} from "effect";
import {ChildProcess} from "effect/process";

import type {TmuxClient, TmuxServer} from "@infraServices/tmux/tmux.infraService.type.ts";
import type {TerminalCommand} from "@interfaces/terminal.infraService.interface.ts";
import type {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

export class TmuxClientNotFoundError extends Schema.TaggedError<
  TmuxClientNotFoundError,
  {readonly brand: unique symbol}
>()("TmuxClientNotFoundError", {}) {}

export class TmuxCommandFailedError extends Schema.TaggedError<
  TmuxCommandFailedError,
  {readonly brand: unique symbol}
>()("TmuxCommandFailedError", {}) {}

export const runTmuxCommand = Effect.fn("TmuxInfraService.runTmuxCommand")(function* (
  tmuxServer: TmuxServer,
  tmuxArguments: readonly string[]
) {
  return yield* tmuxServer.childProcessSpawner.lines(
    ChildProcess.make(TMUX.COMMAND, ["-S", tmuxServer.tmuxSocketPath, ...tmuxArguments])
  );
});

// Reading a command's lines succeeds whatever tmux answers, so its exit code says whether it ran.
export const runCheckedTmuxCommand = Effect.fn("TmuxInfraService.runCheckedTmuxCommand")(function* (
  tmuxServer: TmuxServer,
  tmuxArguments: readonly string[]
) {
  const tmuxExitCode = yield* Effect.orElseSucceed(
    tmuxServer.childProcessSpawner.exitCode(
      ChildProcess.make(TMUX.COMMAND, ["-S", tmuxServer.tmuxSocketPath, ...tmuxArguments])
    ),
    () => -1
  );

  return yield* tmuxExitCode === 0 ? Effect.void : Effect.fail(TmuxCommandFailedError.make());
});

// A build without a version number, such as "tmux master", is taken as new enough.
export const checkTmuxVersion = Effect.fn("TmuxInfraService.checkTmuxVersion")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"]
) {
  const versionLines = yield* Effect.mapError(childProcessSpawner.lines(ChildProcess.make(TMUX.COMMAND, ["-V"])), () =>
    TmuxUnavailableError.make({})
  );
  const [foundVersion = ""] = versionLines;
  if (!String.startsWith(TMUX.VERSION_PREFIX)(foundVersion)) return yield* TmuxUnavailableError.make({});
  const versionNumber = Result.fromOption(String.match(TMUX.VERSION_NUMBER_PATTERN)(foundVersion), () => undefined);
  if (Result.isFailure(versionNumber)) return foundVersion;
  const versionParts = versionNumber.success.groups === undefined ? {} : versionNumber.success.groups;
  const majorVersion = Number(versionParts.major === undefined ? "0" : versionParts.major);
  const minorVersion = Number(versionParts.minor === undefined ? "0" : versionParts.minor);
  const isTooOld =
    majorVersion < TMUX.MINIMUM_VERSION.MAJOR ||
    (majorVersion === TMUX.MINIMUM_VERSION.MAJOR && minorVersion < TMUX.MINIMUM_VERSION.MINOR);
  if (isTooOld) return yield* TmuxUnavailableError.make({foundVersion});

  return foundVersion;
});

// tmux reads a "#" in a folder it is given as the start of a format, as in "#S", unless the "#" is doubled.
export const escapeTmuxFormat = Effect.fn("TmuxInfraService.escapeTmuxFormat")(function* (text: string) {
  return String.replaceAll("#", "##")(text);
});

// No tmux, or no server yet, runs nothing.
export const listTmuxSessionNames = Effect.fn("TmuxInfraService.listTmuxSessionNames")(function* (
  tmuxServer: TmuxServer
) {
  return yield* Effect.orElseSucceed(
    runTmuxCommand(tmuxServer, ["list-sessions", "-F", "#{session_name}"]),
    (): readonly string[] => []
  );
});

// The path comes last, since it alone can hold spaces; no tmux, or no server yet, has no clients.
export const listTmuxClients = Effect.fn("TmuxInfraService.listTmuxClients")(function* (tmuxServer: TmuxServer) {
  const clientLines = yield* Effect.orElseSucceed(
    runTmuxCommand(tmuxServer, [
      ...["list-clients", "-F"],
      "#{client_pid} #{client_name} #{session_name} #{session_path}"
    ]),
    (): readonly string[] => []
  );

  return Array.map(clientLines, (clientLine): TmuxClient => {
    const [clientProcessId, clientName = "", sessionName = "", ...sessionPathParts] = String.split(" ")(clientLine);

    return {
      clientName,
      sessionName,
      sessionPath: Array.join(sessionPathParts, " "),
      terminalProcessId: Number(clientProcessId)
    };
  });
});

export const findTmuxClient = Effect.fn("TmuxInfraService.findTmuxClient")(function* (
  tmuxServer: TmuxServer,
  terminalProcessId: number
) {
  const tmuxClients = yield* listTmuxClients(tmuxServer);

  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(tmuxClients, (tmuxClient) => tmuxClient.terminalProcessId === terminalProcessId),
      () => TmuxClientNotFoundError.make()
    )
  );
});

// -E keeps the terminal's own variables, the id of the session it opened with among them, out of the session it now shows.
export const switchTmuxClient = Effect.fn("TmuxInfraService.switchTmuxClient")(function* (
  tmuxServer: TmuxServer,
  terminalProcessId: number,
  sessionName: string
) {
  const tmuxClient = yield* findTmuxClient(tmuxServer, terminalProcessId);

  yield* runCheckedTmuxCommand(tmuxServer, [
    ...["switch-client", "-E"],
    ...["-c", tmuxClient.clientName, "-t", `=${sessionName}`]
  ]);
});

// A session that has already ended has nothing to kill.
export const killTmuxSession = Effect.fn("TmuxInfraService.killTmuxSession")(function* (
  tmuxServer: TmuxServer,
  sessionName: string
) {
  yield* Effect.ignore(runTmuxCommand(tmuxServer, ["kill-session", "-t", `=${sessionName}`]), {
    log: "Debug",
    message: "tmux did not kill the session"
  });
});

// Without a systemd user manager, what tmux starts runs in the tmux server's cgroup.
export const prepareOwnScopeArguments = Effect.fn("TmuxInfraService.prepareOwnScopeArguments")(function* (
  tmuxServer: TmuxServer,
  memoryLimit: string | undefined
) {
  if (!tmuxServer.canRunInOwnScope) return [];
  const memoryLimitArguments =
    memoryLimit === undefined ? [] : ["-p", `${SYSTEMD_SCOPE.MEMORY_LIMIT_PROPERTY}=${memoryLimit}`];

  return [SYSTEMD_SCOPE.COMMAND, ...SYSTEMD_SCOPE.OPTIONS, ...memoryLimitArguments, "--"];
});

// The terminal's tmux client starts the tmux server, which stays in the client's cgroup, so the client gets one of its own.
export const prepareTerminalCommand = Effect.fn("TmuxInfraService.prepareTerminalCommand")(function* (
  tmuxServer: TmuxServer,
  tmuxCommandArguments: readonly string[]
) {
  const tmuxArguments = [
    ...["-S", tmuxServer.tmuxSocketPath, "-f", tmuxServer.tmuxConfigPath, "-u"],
    ...tmuxCommandArguments
  ];
  const terminalCommand: TerminalCommand = tmuxServer.canRunInOwnScope
    ? {
        command: SYSTEMD_SCOPE.COMMAND,
        commandArguments: [...SYSTEMD_SCOPE.OPTIONS, "--", TMUX.COMMAND, ...tmuxArguments]
      }
    : {command: TMUX.COMMAND, commandArguments: tmuxArguments};

  return terminalCommand;
});

// Without a systemd user manager (macOS, WSL without systemd, a container) sessions run in VS Code's cgroup.
export const probeOwnScope = Effect.fn("TmuxInfraService.probeOwnScope")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"]
) {
  const probeExitCode = yield* Effect.orElseSucceed(
    childProcessSpawner.exitCode(
      ChildProcess.make(SYSTEMD_SCOPE.COMMAND, [...SYSTEMD_SCOPE.OPTIONS, "--", SYSTEMD_SCOPE.PROBE_COMMAND])
    ),
    () => -1
  );
  const canRunInOwnScope = probeExitCode === 0;
  yield* Effect.annotateCurrentSpan({canRunInOwnScope});

  return canRunInOwnScope;
});
