import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {REQUIRED_TOOLS_COMMANDS, REQUIRED_TOOLS_LABELS} from "@pkg/constants/src/requiredTools.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {TERMINAL_ERRORS} from "@pkg/constants/src/terminal.constant.ts";
import {TMUX_ERRORS} from "@pkg/constants/src/tmux.constant.ts";
import {Context, Effect, Layer, Match} from "effect";

import type {FolderShellService} from "@services/folderShell.service.ts";

type FolderShellCommandError = Effect.Error<
  ReturnType<FolderShellService["Service"]["openProjectTerminal" | "openSessionFolderTerminal"]>
>;

export class FolderShellErrorMessage extends Context.Service<FolderShellErrorMessage>()(
  "aggregor-app/presentation/errorMessages/folderShell.errorMessage/FolderShellErrorMessage",
  {
    make: Effect.fn("FolderShellErrorMessage.make")(function* () {
      const getFolderShellCommandErrorMessage = Effect.fn("FolderShellErrorMessage.getFolderShellCommandErrorMessage")(
        function* (folderShellCommandError: FolderShellCommandError) {
          return Match.valueTags(folderShellCommandError, {
            DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
            FolderShellSwitchFailedError: () => ({message: TERMINAL_ERRORS.LAUNCH_FAILED}),
            SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
            TerminalLaunchFailedError: () => ({message: TERMINAL_ERRORS.LAUNCH_FAILED}),
            TmuxUnavailableError: (error) => ({
              commandToRun: {commandId: REQUIRED_TOOLS_COMMANDS.INSTALL, label: REQUIRED_TOOLS_LABELS.INSTALL},
              message:
                error.foundVersion === undefined ? TMUX_ERRORS.NOT_INSTALLED : TMUX_ERRORS.TOO_OLD(error.foundVersion)
            })
          });
        }
      );

      return {getFolderShellCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
