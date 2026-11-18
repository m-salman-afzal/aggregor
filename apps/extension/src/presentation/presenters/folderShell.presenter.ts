import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {REQUIRED_TOOLS_COMMANDS, REQUIRED_TOOLS_LABELS} from "@pkg/constants/src/requiredTools.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {TERMINAL_ERRORS} from "@pkg/constants/src/terminal.constant.ts";
import {TMUX_ERRORS} from "@pkg/constants/src/tmux.constant.ts";
import {Effect, Match} from "effect";

import type {openProjectTerminal, openSessionFolderTerminal} from "@services/folderShell.service.ts";

type FolderShellCommandError = Effect.Error<ReturnType<typeof openProjectTerminal | typeof openSessionFolderTerminal>>;

export const presentFolderShellCommandError = Effect.fn("FolderShellPresenter.presentFolderShellCommandError")(
  function* (folderShellCommandError: FolderShellCommandError) {
    return Match.valueTags(folderShellCommandError, {
      DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
      FolderShellSwitchFailedError: () => ({message: TERMINAL_ERRORS.LAUNCH_FAILED}),
      SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
      TerminalLaunchFailedError: () => ({message: TERMINAL_ERRORS.LAUNCH_FAILED}),
      TmuxUnavailableError: (error) => ({
        commandToRun: {commandId: REQUIRED_TOOLS_COMMANDS.INSTALL, label: REQUIRED_TOOLS_LABELS.INSTALL},
        message: error.foundVersion === undefined ? TMUX_ERRORS.NOT_INSTALLED : TMUX_ERRORS.TOO_OLD(error.foundVersion)
      })
    });
  }
);
