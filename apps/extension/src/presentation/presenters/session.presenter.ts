import {AGENT_ERRORS, AGENTS_SETTING_ID} from "@pkg/constants/src/agent.constant.ts";
import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {TMUX, TMUX_ERRORS, TMUX_LABELS} from "@pkg/constants/src/tmux.constant.ts";
import {Array, Effect, Match} from "effect";

import type {
  archiveOngoingSessions,
  archiveProjectSessions,
  archiveSession,
  moveSessionDown,
  moveSessionUp,
  newSession,
  openSession,
  removeSession,
  renameSession,
  stopArchivedProjectSessionAgents,
  stopArchivedSessionAgents,
  stopProjectSessionAgents,
  stopSessionAgent,
  unarchiveSession
} from "@services/session.service.ts";

type SessionCommandError = Effect.Error<
  ReturnType<
    | typeof archiveOngoingSessions
    | typeof archiveProjectSessions
    | typeof archiveSession
    | typeof moveSessionDown
    | typeof moveSessionUp
    | typeof newSession
    | typeof openSession
    | typeof removeSession
    | typeof renameSession
    | typeof stopArchivedProjectSessionAgents
    | typeof stopArchivedSessionAgents
    | typeof stopProjectSessionAgents
    | typeof stopSessionAgent
    | typeof unarchiveSession
  >
>;

export const presentSessionCommandError = Effect.fn("SessionPresenter.presentSessionCommandError")(function* (
  sessionCommandError: SessionCommandError
) {
  return Match.valueTags(sessionCommandError, {
    AgentNotFoundError: (error) => ({message: AGENT_ERRORS.NOT_FOUND(error.agentId), settingToOpen: AGENTS_SETTING_ID}),
    AgentSessionIdNotFoundError: (error) => ({message: SESSION_ERRORS.AGENT_SESSION_ID_NOT_FOUND(error.agentName)}),
    DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
    DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
    InvalidSettingsError: (error) => ({message: SESSION_ERRORS.INVALID_SETTINGS(error.reason)}),
    NoAgentInstalledError: (error) => ({
      message: AGENT_ERRORS.NONE_INSTALLED(Array.join(error.searchedCommands, ", ")),
      settingToOpen: AGENTS_SETTING_ID
    }),
    NoProjectError: () => ({message: SESSION_ERRORS.PROJECT_REQUIRED}),
    PtyBinaryNotFoundError: (error) => ({
      message: error.isWindows ? SESSION_ERRORS.PTY_BINARY_NOT_FOUND_ON_WINDOWS : SESSION_ERRORS.PTY_BINARY_NOT_FOUND
    }),
    SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
    TerminalLaunchFailedError: () => ({message: SESSION_ERRORS.LAUNCH_FAILED}),
    TmuxUnavailableError: (error) => ({
      message: error.foundVersion === undefined ? TMUX_ERRORS.NOT_INSTALLED : TMUX_ERRORS.TOO_OLD(error.foundVersion),
      pageToOpen: {label: TMUX_LABELS.INSTALL, url: TMUX.INSTALL_PAGE}
    })
  });
});
