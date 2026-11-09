import {AGENT_ERRORS, AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {TMUX_ERRORS, TMUX_INSTALL_PAGE, TMUX_LABELS} from "@pkg/constants/src/tmux.constant.ts";
import {Effect, Match} from "effect";

import type {newSession, openSession, removeSession, renameSession} from "@services/session.service.ts";

// Every failure the session commands' use cases return.
type SessionCommandError = Effect.Error<
  ReturnType<typeof newSession | typeof openSession | typeof removeSession | typeof renameSession>
>;

const AGENTS_SETTING = `${SETTINGS_SECTION}.${AGENT_SETTINGS.AGENTS}`;

// The message a failed session command shows the user, and the setting or page that fixes it, when one does.
export const presentSessionCommandError = Effect.fn("SessionPresenter.presentSessionCommandError")(function* (
  sessionCommandError: SessionCommandError
) {
  return Match.valueTags(sessionCommandError, {
    AgentNotFoundError: ({agentId}) => ({
      message: AGENT_ERRORS.NOT_FOUND(agentId),
      settingToOpen: AGENTS_SETTING
    }),
    AgentSessionIdNotFoundError: ({agentName}) => ({message: SESSION_ERRORS.AGENT_SESSION_ID_NOT_FOUND(agentName)}),
    DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
    DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
    InvalidSettingsError: ({reason}) => ({message: SESSION_ERRORS.INVALID_SETTINGS(reason)}),
    NoAgentInstalledError: ({searchedCommands}) => ({
      message: AGENT_ERRORS.NONE_INSTALLED(searchedCommands),
      settingToOpen: AGENTS_SETTING
    }),
    NoProjectError: () => ({message: SESSION_ERRORS.PROJECT_REQUIRED}),
    PtyBinaryNotFoundError: ({isWindows}) => ({message: SESSION_ERRORS.PTY_BINARY_NOT_FOUND(isWindows)}),
    SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
    TerminalLaunchFailedError: () => ({message: SESSION_ERRORS.LAUNCH_FAILED}),
    TmuxUnavailableError: ({foundVersion}) => ({
      message: TMUX_ERRORS.UNAVAILABLE(foundVersion),
      pageToOpen: {label: TMUX_LABELS.INSTALL, url: TMUX_INSTALL_PAGE}
    })
  });
});
