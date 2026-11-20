import {NodeServices} from "@effect/platform-node";
import {TmuxSocketUtils} from "@infraUtils/tmuxSocket.utils.ts";
import {ITmuxInfraServiceErrors} from "@interfaces/tmux.infraService.interface.ts";
import {SYSTEMD_SCOPE, TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Array, Context, Effect, Layer, Result, String} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {TmuxClient} from "@infraServices/tmux/tmux.infraService.type.ts";
import type {TerminalCommand} from "@interfaces/terminal.infraService.interface.ts";
import type {TmuxSessionPanes} from "@interfaces/tmux.infraService.interface.ts";

export class TmuxServerUtilsErrors extends TaggedErrors({
  TmuxClientNotFoundError: {},
  TmuxCommandFailedError: {}
}) {}

export class TmuxServerUtils extends Context.Service<TmuxServerUtils>()(
  "aggregor-app/infrastructure/services/tmux/tmuxServer.utils/TmuxServerUtils",
  {
    make: Effect.fn("make")(function* () {
      const childProcessSpawner = yield* ChildProcessSpawner;
      const vsCodeApi = yield* VsCodeApi;
      const tmuxSocketUtils = yield* TmuxSocketUtils;

      // Without a systemd user manager (macOS, WSL without systemd, a container) sessions run in VS Code's cgroup.
      const probeOwnScope = Effect.fn("probeOwnScope")(function* () {
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

      const canRunInOwnScope = yield* probeOwnScope();
      const tmuxConfigPath = vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, TMUX.CONFIG_FILE).fsPath;
      const tmuxSocketPath = yield* tmuxSocketUtils.getTmuxSocketPath;

      const runTmuxCommand = Effect.fn("runTmuxCommand")(function* (tmuxArguments: readonly string[]) {
        return yield* childProcessSpawner.lines(
          ChildProcess.make(TMUX.COMMAND, ["-S", tmuxSocketPath, ...tmuxArguments])
        );
      });

      // Reading a command's lines succeeds whatever tmux answers, so its exit code says whether it ran.
      const runCheckedTmuxCommand = Effect.fn("runCheckedTmuxCommand")(function* (tmuxArguments: readonly string[]) {
        const tmuxExitCode = yield* Effect.orElseSucceed(
          childProcessSpawner.exitCode(ChildProcess.make(TMUX.COMMAND, ["-S", tmuxSocketPath, ...tmuxArguments])),
          () => -1
        );

        return yield* tmuxExitCode === 0
          ? Effect.void
          : Effect.fail(TmuxServerUtilsErrors.TmuxCommandFailedError.make());
      });

      // A build without a version number, such as "tmux master", is taken as new enough.
      const checkTmuxVersion = Effect.fn("checkTmuxVersion")(function* () {
        const versionLines = yield* Effect.mapError(
          childProcessSpawner.lines(ChildProcess.make(TMUX.COMMAND, ["-V"])),
          () => ITmuxInfraServiceErrors.TmuxUnavailableError.make({})
        );
        const [foundVersion = ""] = versionLines;
        if (!String.startsWith(TMUX.VERSION_PREFIX)(foundVersion))
          return yield* ITmuxInfraServiceErrors.TmuxUnavailableError.make({});
        const versionNumber = Result.fromOption(
          String.match(TMUX.VERSION_NUMBER_PATTERN)(foundVersion),
          () => undefined
        );
        if (Result.isFailure(versionNumber)) return foundVersion;
        const versionParts = versionNumber.success.groups === undefined ? {} : versionNumber.success.groups;
        const majorVersion = Number(versionParts.major === undefined ? "0" : versionParts.major);
        const minorVersion = Number(versionParts.minor === undefined ? "0" : versionParts.minor);
        const isTooOld =
          majorVersion < TMUX.MINIMUM_VERSION.MAJOR ||
          (majorVersion === TMUX.MINIMUM_VERSION.MAJOR && minorVersion < TMUX.MINIMUM_VERSION.MINOR);
        if (isTooOld) return yield* ITmuxInfraServiceErrors.TmuxUnavailableError.make({foundVersion});

        return foundVersion;
      });

      // tmux reads a "#" in a folder it is given as the start of a format, as in "#S", unless the "#" is doubled.
      const escapeTmuxFormat = Effect.fn("escapeTmuxFormat")(function* (text: string) {
        return String.replaceAll("#", "##")(text);
      });

      const listTmuxSessionNames = Effect.fn("listTmuxSessionNames")(function* () {
        return yield* Effect.orElseSucceed(
          runTmuxCommand(["list-sessions", "-F", "#{session_name}"]),
          (): readonly string[] => []
        );
      });

      // The path comes last, since it alone can hold spaces.
      const listTmuxClients = Effect.fn("listTmuxClients")(function* () {
        const clientLines = yield* Effect.orElseSucceed(
          runTmuxCommand([...["list-clients", "-F"], "#{client_pid} #{client_name} #{session_name} #{session_path}"]),
          (): readonly string[] => []
        );

        return Array.map(clientLines, (clientLine): TmuxClient => {
          const [clientProcessId, clientName = "", sessionName = "", ...sessionPathParts] =
            String.split(" ")(clientLine);

          return {
            clientName,
            sessionName,
            sessionPath: Array.join(sessionPathParts, " "),
            terminalProcessId: Number(clientProcessId)
          };
        });
      });

      // Every pane of every window, so a pane the user split off counts too; #{pid} is the server's own.
      const readTmuxSessionPanes = Effect.fn("readTmuxSessionPanes")(function* (sessionName: string) {
        const paneLines = yield* Effect.orElseSucceed(
          runTmuxCommand(["list-panes", "-s", "-t", `=${sessionName}`, "-F", "#{pane_pid} #{pid}"]),
          (): readonly string[] => []
        );
        const tmuxPanes = Array.map(paneLines, (paneLine) => {
          const [paneProcessId, tmuxServerProcessId = ""] = String.split(" ")(paneLine);

          return {paneProcessId: Number(paneProcessId), tmuxServerProcessId: Number(tmuxServerProcessId)};
        });
        const [firstTmuxPane] = tmuxPanes;
        if (firstTmuxPane === undefined) return yield* ITmuxInfraServiceErrors.TmuxSessionNotRunningError.make();
        const tmuxSessionPanes: TmuxSessionPanes = {
          paneProcessIds: Array.map(tmuxPanes, (tmuxPane) => tmuxPane.paneProcessId),
          tmuxServerProcessId: firstTmuxPane.tmuxServerProcessId
        };

        return tmuxSessionPanes;
      });

      const findTmuxClient = Effect.fn("findTmuxClient")(function* (terminalProcessId: number) {
        const tmuxClients = yield* listTmuxClients();

        return yield* Effect.fromResult(
          Result.fromOption(
            Array.findFirst(tmuxClients, (tmuxClient) => tmuxClient.terminalProcessId === terminalProcessId),
            () => TmuxServerUtilsErrors.TmuxClientNotFoundError.make()
          )
        );
      });

      // -E keeps the terminal's own variables, the id of the session it opened with among them, out of the session it now shows.
      const switchTmuxClient = Effect.fn("switchTmuxClient")(function* (
        terminalProcessId: number,
        sessionName: string
      ) {
        const tmuxClient = yield* findTmuxClient(terminalProcessId);

        yield* runCheckedTmuxCommand([
          ...["switch-client", "-E"],
          ...["-c", tmuxClient.clientName, "-t", `=${sessionName}`]
        ]);
      });

      const killTmuxSession = Effect.fn("killTmuxSession")(function* (sessionName: string) {
        yield* Effect.ignore(runTmuxCommand(["kill-session", "-t", `=${sessionName}`]), {
          log: "Debug",
          message: "tmux did not kill the session"
        });
      });

      const prepareOwnScopeArguments = Effect.fn("prepareOwnScopeArguments")(function* (
        memoryLimit: string | undefined
      ) {
        if (!canRunInOwnScope) return [];
        const memoryLimitArguments =
          memoryLimit === undefined ? [] : ["-p", `${SYSTEMD_SCOPE.MEMORY_LIMIT_PROPERTY}=${memoryLimit}`];

        return [SYSTEMD_SCOPE.COMMAND, ...SYSTEMD_SCOPE.OPTIONS, ...memoryLimitArguments, "--"];
      });

      // The terminal's tmux client starts the tmux server, which stays in the client's cgroup, so the client gets one of its own.
      const prepareTerminalCommand = Effect.fn("prepareTerminalCommand")(function* (
        tmuxCommandArguments: readonly string[]
      ) {
        const tmuxArguments = [...["-S", tmuxSocketPath, "-f", tmuxConfigPath, "-u"], ...tmuxCommandArguments];
        const terminalCommand: TerminalCommand = canRunInOwnScope
          ? {
              command: SYSTEMD_SCOPE.COMMAND,
              commandArguments: [...SYSTEMD_SCOPE.OPTIONS, "--", TMUX.COMMAND, ...tmuxArguments]
            }
          : {command: TMUX.COMMAND, commandArguments: tmuxArguments};

        return terminalCommand;
      });

      return {
        checkTmuxVersion: checkTmuxVersion(),
        escapeTmuxFormat,
        findTmuxClient,
        killTmuxSession,
        listTmuxClients: listTmuxClients(),
        listTmuxSessionNames: listTmuxSessionNames(),
        prepareOwnScopeArguments,
        prepareTerminalCommand,
        probeOwnScope: probeOwnScope(),
        readTmuxSessionPanes,
        runCheckedTmuxCommand,
        runTmuxCommand,
        switchTmuxClient,
        tmuxConfigPath
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("TmuxServerUtils", this.make())).pipe(
    Layer.provide([TmuxSocketUtils.layer, NodeServices.layer])
  );
}
