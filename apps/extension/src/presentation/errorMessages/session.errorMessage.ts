import {AGENT_ERRORS, AGENTS_SETTING_ID} from "@pkg/constants/src/agent.constant.ts";
import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {WORKTREE_ERRORS} from "@pkg/constants/src/git.constant.ts";
import {REQUIRED_TOOLS_COMMANDS, REQUIRED_TOOLS_LABELS} from "@pkg/constants/src/requiredTools.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {TMUX_ERRORS} from "@pkg/constants/src/tmux.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Context, Effect, Layer, Match} from "effect";

import type {SessionService} from "@services/session.service.ts";

type SessionCommandError = Effect.Error<
  | ReturnType<
      SessionService["Service"][
        | "archiveProjectSessions"
        | "archiveSession"
        | "changeSessionWorkingTree"
        | "createSession"
        | "moveSessionDown"
        | "moveSessionUp"
        | "openSession"
        | "removeSession"
        | "renameSession"
        | "renameSessionBranch"
        | "stopArchivedProjectSessionAgents"
        | "stopProjectSessionAgents"
        | "stopSessionAgent"
        | "unarchiveSession"
        | "unlinkSessionWorktree"]
    >
  | SessionService["Service"]["archiveOngoingSessions" | "stopArchivedSessionAgents"]
>;

export class SessionErrorMessage extends Context.Service<SessionErrorMessage>()(
  "aggregor-app/presentation/errorMessages/session.errorMessage/SessionErrorMessage",
  {
    make: Effect.fn("make")(function* () {
      // eslint-disable-next-line aggregor/max-lines-per-function -- one line per failure of the session commands
      const getSessionCommandErrorMessage = Effect.fn("getSessionCommandErrorMessage")(function* (
        sessionCommandError: SessionCommandError
      ) {
        return Match.valueTags(sessionCommandError, {
          AgentNotFoundError: (error) => ({
            message: AGENT_ERRORS.NOT_FOUND(error.agentId),
            settingToOpen: AGENTS_SETTING_ID
          }),
          AgentSessionIdNotFoundError: (error) => ({
            message: SESSION_ERRORS.AGENT_SESSION_ID_NOT_FOUND(error.agentName)
          }),
          BranchRenameFailedError: (error) => ({message: WORKTREE_ERRORS.BRANCH_RENAME_FAILED(error.gitError)}),
          DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
          DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
          InvalidSettingsError: (error) => ({message: SESSION_ERRORS.INVALID_SETTINGS(error.reason)}),
          NoAgentInstalledError: (error) => ({
            message: AGENT_ERRORS.NONE_INSTALLED(Array.join(error.searchedCommands, ", ")),
            settingToOpen: AGENTS_SETTING_ID
          }),
          PtyBinaryNotFoundError: (error) => ({
            message: error.isWindows
              ? SESSION_ERRORS.PTY_BINARY_NOT_FOUND_ON_WINDOWS
              : SESSION_ERRORS.PTY_BINARY_NOT_FOUND
          }),
          SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
          SessionNotInWorktreeError: () => ({message: WORKTREE_ERRORS.NOT_IN_WORKTREE}),
          TerminalLaunchFailedError: () => ({message: SESSION_ERRORS.LAUNCH_FAILED}),
          TmuxUnavailableError: (error) => ({
            commandToRun: {commandId: REQUIRED_TOOLS_COMMANDS.INSTALL, label: REQUIRED_TOOLS_LABELS.INSTALL},
            message:
              error.foundVersion === undefined ? TMUX_ERRORS.NOT_INSTALLED : TMUX_ERRORS.TOO_OLD(error.foundVersion)
          }),
          WorktreeCreateFailedError: (error) => ({message: WORKTREE_ERRORS.CREATE_FAILED(error.gitError)}),
          WorktreeHasChangesError: () => ({message: WORKTREE_ERRORS.HAS_CHANGES}),
          WorktreeNotFoundError: () => ({message: WORKTREE_ERRORS.NOT_FOUND}),
          WorktreeRemoveFailedError: (error) => ({message: WORKTREE_ERRORS.REMOVE_FAILED(error.gitError)})
        });
      });

      return {getSessionCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionErrorMessage", this.make()));
}
