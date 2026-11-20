import {FolderShellDomainService} from "@domainServices/folderShell.domainService.ts";
import {NodeServices} from "@effect/platform-node";
import {TmuxServerUtils} from "@infraServices/tmux/tmuxServer.utils.ts";
import {ITmuxInfraServiceErrors} from "@interfaces/tmux.infraService.interface.ts";
import {FOLDER_SHELL, TMUX, TMUX_CLIENT_WAIT} from "@pkg/constants/src/tmux.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Context, Effect, Layer, Schedule, String} from "effect";
import {Path} from "effect/Path";

import type {FolderShellRequest} from "@interfaces/tmux.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class FolderShellUtils extends Context.Service<FolderShellUtils>()(
  "aggregor-app/infrastructure/services/tmux/folderShell.utils/FolderShellUtils",
  {
    make: Effect.fn("make")(function* () {
      const path = yield* Path;
      const folderShellDomainService = yield* FolderShellDomainService;
      const tmuxServerUtils = yield* TmuxServerUtils;

      const nameFolderShell = Effect.fn("nameFolderShell")(function* (folderPath: ProjectPathValueObject) {
        return yield* folderShellDomainService.getFolderShellName(path.basename(folderPath), folderPath);
      });

      // The shell sees no tmux, as in a plain terminal: the user's own tmux starts there, and none of its commands reach Aggregor's.
      const prepareShellArguments = Effect.fn("prepareShellArguments")(function* () {
        const ownScopeArguments = yield* tmuxServerUtils.prepareOwnScopeArguments(undefined);

        return ["--", TMUX.SETUP_SHELL, "-c", FOLDER_SHELL.START_SCRIPT, TMUX.SETUP_SHELL, ...ownScopeArguments];
      });

      // One tmux command list: the shell's session, then the session's own options, which tmux applies to the pane it has.
      const prepareFolderShellArguments = Effect.fn("prepareFolderShellArguments")(function* (
        folderShellRequest: FolderShellRequest,
        newSessionFlags: readonly string[]
      ) {
        const folderShellName = yield* nameFolderShell(folderShellRequest.folderPath);
        const sessionOptionArguments = [";", "set-option", "-t", `=${folderShellName}:`];

        return [
          ...["new-session", ...newSessionFlags, "-s", folderShellName],
          ...["-c", yield* tmuxServerUtils.escapeTmuxFormat(folderShellRequest.folderPath)],
          ...(yield* prepareShellArguments()),
          ...[...sessionOptionArguments, "status", "on"],
          ...[...sessionOptionArguments, "history-limit", FOLDER_SHELL.HISTORY_LINES],
          ...[...sessionOptionArguments, FOLDER_SHELL.STATUS_LABEL_OPTION, folderShellRequest.statusLabel]
        ];
      });

      // -A attaches to the folder's shell when it runs, and otherwise starts it with the terminal's own variables.
      const prepareFolderShellTerminalCommand = Effect.fn("prepareFolderShellTerminalCommand")(function* (
        folderShellRequest: FolderShellRequest
      ) {
        yield* tmuxServerUtils.checkTmuxVersion;
        const folderShellArguments = yield* prepareFolderShellArguments(folderShellRequest, ["-A"]);

        return yield* tmuxServerUtils.prepareTerminalCommand(folderShellArguments);
      });

      // shortcut: a value ending in ";" would end the tmux command there; escape it as "\;" once a variable holds one.
      const readSessionEnvironmentFlags = Effect.fn("readSessionEnvironmentFlags")(function* (sessionName: string) {
        const environmentLines = yield* Effect.orElseSucceed(
          tmuxServerUtils.runTmuxCommand(["show-environment", "-t", `=${sessionName}:`]),
          (): readonly string[] => []
        );
        // tmux lists a variable the session removed as "-NAME".
        const setVariableLines = Array.filter(
          environmentLines,
          (environmentLine) => !String.startsWith("-")(environmentLine)
        );

        return Array.flatMap(setVariableLines, (setVariableLine) => ["-e", setVariableLine]);
      });

      // The extension's process lacks what VS Code gives a terminal, git's credential helper among it, so the shown shell's is copied.
      const startFolderShell = Effect.fn("startFolderShell")(function* (
        shownSessionName: string,
        folderShellRequest: FolderShellRequest
      ) {
        const environmentFlags = yield* readSessionEnvironmentFlags(shownSessionName);
        const folderShellArguments = yield* prepareFolderShellArguments(folderShellRequest, [
          "-d",
          ...environmentFlags
        ]);

        yield* tmuxServerUtils.runCheckedTmuxCommand(folderShellArguments);
      });

      const findTerminalClientOnceAttached = Effect.fn("findTerminalClientOnceAttached")(function* (
        terminalProcessId: number
      ) {
        return yield* Effect.retry(tmuxServerUtils.findTmuxClient(terminalProcessId), {
          schedule: Schedule.spaced(TMUX_CLIENT_WAIT.POLL_INTERVAL_MS),
          times: TMUX_CLIENT_WAIT.TIMEOUT_MS / TMUX_CLIENT_WAIT.POLL_INTERVAL_MS
        });
      });

      const switchTerminalToFolderShell = Effect.fn("switchTerminalToFolderShell")(function* (
        terminalProcessId: number,
        folderShellRequest: FolderShellRequest
      ) {
        const terminalClient = yield* findTerminalClientOnceAttached(terminalProcessId);
        const folderShellName = yield* nameFolderShell(folderShellRequest.folderPath);
        const runningSessionNames = yield* tmuxServerUtils.listTmuxSessionNames;
        if (!runningSessionNames.includes(folderShellName))
          yield* startFolderShell(terminalClient.sessionName, folderShellRequest);

        yield* tmuxServerUtils.switchTmuxClient(terminalProcessId, folderShellName);
      });

      const showFolderShellInTerminal = Effect.fn("showFolderShellInTerminal")(function* (
        terminalProcessId: number,
        folderShellRequest: FolderShellRequest
      ) {
        yield* Effect.mapError(switchTerminalToFolderShell(terminalProcessId, folderShellRequest), () =>
          ITmuxInfraServiceErrors.FolderShellSwitchFailedError.make({folderPath: folderShellRequest.folderPath})
        );
      });

      const readFolderShellPanes = Effect.fn("readFolderShellPanes")(function* (folderPath: ProjectPathValueObject) {
        const folderShellName = yield* nameFolderShell(folderPath);

        return yield* tmuxServerUtils.readTmuxSessionPanes(folderShellName);
      });

      // A shell's tmux session keeps the folder it was started in as its path.
      const readFolderShellPathShownInTerminal = Effect.fn("readFolderShellPathShownInTerminal")(
        function* (terminalProcessId: number) {
          const terminalClient = yield* tmuxServerUtils.findTmuxClient(terminalProcessId);

          return ProjectPathValueObjectSchema.make(terminalClient.sessionPath);
        },
        Effect.mapError(() => ITmuxInfraServiceErrors.FolderShellNotShownError.make())
      );

      const endFolderShell = Effect.fn("endFolderShell")(function* (folderPath: ProjectPathValueObject) {
        const folderShellName = yield* nameFolderShell(folderPath);

        yield* tmuxServerUtils.killTmuxSession(folderShellName);
      });

      return {
        endFolderShell,
        prepareFolderShellTerminalCommand,
        readFolderShellPanes,
        readFolderShellPathShownInTerminal,
        showFolderShellInTerminal
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("FolderShellUtils", this.make())).pipe(
    Layer.provide([TmuxServerUtils.layer, NodeServices.layer])
  );
}
