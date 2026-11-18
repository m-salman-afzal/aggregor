import {setChosenAgentAsDefault} from "@controllers/agent.controller.ts";
import {generateCommitMessageForSourceControl} from "@controllers/commitMessage.controller.ts";
import {openChosenProjectTerminal, openChosenSessionFolderTerminal} from "@controllers/folderShell.controller.ts";
import {
  addProjectsAskingForFolders,
  moveChosenProjectDown,
  moveChosenProjectUp,
  removeChosenProject,
  saveChosenProjectSettings
} from "@controllers/project.controller.ts";
import {openChosenSessionPullRequest, signInToGitHubCliFromNotice} from "@controllers/pullRequest.controller.ts";
import {installRequiredToolsFromNotice} from "@controllers/requiredTools.controller.ts";
import {
  archiveAllOngoingSessions,
  archiveChosenProjectSessions,
  archiveChosenSession,
  moveChosenSessionDown,
  moveChosenSessionUp,
  newSessionInChosenProject,
  openChosenSession,
  removeChosenSession,
  renameChosenSession,
  renameChosenSessionBranch,
  stopAllArchivedSessionAgents,
  stopAllOngoingSessionAgents,
  stopChosenArchivedProjectSessionAgents,
  stopChosenProjectSessionAgents,
  stopChosenSessionAgent,
  unarchiveChosenSession
} from "@controllers/session.controller.ts";
import {importChosenSessions} from "@controllers/sessionImport.controller.ts";
import {cleanUpChosenProjectLeftovers} from "@controllers/worktree.controller.ts";
import {registerCommand} from "@middlewares/registerCommand.middleware.ts";
import {AGENT_COMMANDS} from "@pkg/constants/src/agent.constant.ts";
import {APP_COMMANDS} from "@pkg/constants/src/app.constant.ts";
import {COMMIT_MESSAGE_COMMANDS} from "@pkg/constants/src/commitMessage.constant.ts";
import {WORKTREE_COMMANDS} from "@pkg/constants/src/git.constant.ts";
import {GITHUB_CLI_COMMANDS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";
import {REQUIRED_TOOLS_COMMANDS} from "@pkg/constants/src/requiredTools.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {TERMINAL_COMMANDS} from "@pkg/constants/src/terminal.constant.ts";
import {openAggregorSettingsInSettingsEditor} from "@pkg/vscode/src/vscode.utils.ts";
import {presentAppCommandError} from "@presenters/app.presenter.ts";
import {presentCommitMessageCommandError} from "@presenters/commitMessage.presenter.ts";
import {presentFolderShellCommandError} from "@presenters/folderShell.presenter.ts";
import {presentProjectCommandError} from "@presenters/project.presenter.ts";
import {presentPullRequestCommandError} from "@presenters/pullRequest.presenter.ts";
import {presentRequiredToolsCommandError} from "@presenters/requiredTools.presenter.ts";
import {presentSessionCommandError} from "@presenters/session.presenter.ts";
import {presentSessionImportCommandError} from "@presenters/sessionImport.presenter.ts";
import {presentWorktreeCommandError} from "@presenters/worktree.presenter.ts";
import {Effect, Layer} from "effect";

// Open Settings only drives VS Code, so it goes straight to the helper, with no controller or use case.
export const RoutesLayer = Layer.effectDiscard(
  Effect.all([
    registerCommand(AGENT_COMMANDS.SET_DEFAULT, setChosenAgentAsDefault, presentAppCommandError),
    registerCommand(APP_COMMANDS.OPEN_SETTINGS, openAggregorSettingsInSettingsEditor, presentAppCommandError),
    registerCommand(
      COMMIT_MESSAGE_COMMANDS.GENERATE,
      generateCommitMessageForSourceControl,
      presentCommitMessageCommandError
    ),
    registerCommand(PROJECT_COMMANDS.ADD, addProjectsAskingForFolders, presentProjectCommandError),
    registerCommand(PROJECT_COMMANDS.MOVE_DOWN, moveChosenProjectDown, presentProjectCommandError),
    registerCommand(PROJECT_COMMANDS.MOVE_UP, moveChosenProjectUp, presentProjectCommandError),
    registerCommand(PROJECT_COMMANDS.REMOVE, removeChosenProject, presentProjectCommandError),
    registerCommand(PROJECT_COMMANDS.SAVE_SETTINGS, saveChosenProjectSettings, presentProjectCommandError),
    registerCommand(SESSION_COMMANDS.ARCHIVE, archiveChosenSession, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.ARCHIVE_ONGOING, archiveAllOngoingSessions, presentSessionCommandError),
    registerCommand(
      SESSION_COMMANDS.ARCHIVE_PROJECT_SESSIONS,
      archiveChosenProjectSessions,
      presentSessionCommandError
    ),
    registerCommand(SESSION_COMMANDS.IMPORT, importChosenSessions, presentSessionImportCommandError),
    registerCommand(SESSION_COMMANDS.MOVE_DOWN, moveChosenSessionDown, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.MOVE_UP, moveChosenSessionUp, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT, newSessionInChosenProject, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.OPEN, openChosenSession, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.REMOVE, removeChosenSession, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.RENAME, renameChosenSession, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.RENAME_BRANCH, renameChosenSessionBranch, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.STOP_AGENT, stopChosenSessionAgent, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.STOP_ARCHIVED_AGENTS, stopAllArchivedSessionAgents, presentSessionCommandError),
    registerCommand(
      SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS,
      stopChosenArchivedProjectSessionAgents,
      presentSessionCommandError
    ),
    registerCommand(SESSION_COMMANDS.STOP_ONGOING_AGENTS, stopAllOngoingSessionAgents, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.STOP_PROJECT_AGENTS, stopChosenProjectSessionAgents, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.UNARCHIVE, unarchiveChosenSession, presentSessionCommandError),
    registerCommand(TERMINAL_COMMANDS.OPEN_PROJECT_TERMINAL, openChosenProjectTerminal, presentFolderShellCommandError),
    registerCommand(
      TERMINAL_COMMANDS.OPEN_SESSION_FOLDER_TERMINAL,
      openChosenSessionFolderTerminal,
      presentFolderShellCommandError
    ),
    registerCommand(
      GITHUB_CLI_COMMANDS.OPEN_SESSION_PULL_REQUEST,
      openChosenSessionPullRequest,
      presentPullRequestCommandError
    ),
    registerCommand(GITHUB_CLI_COMMANDS.SIGN_IN, signInToGitHubCliFromNotice, presentPullRequestCommandError),
    registerCommand(REQUIRED_TOOLS_COMMANDS.INSTALL, installRequiredToolsFromNotice, presentRequiredToolsCommandError),
    registerCommand(WORKTREE_COMMANDS.CLEAN_UP_LEFTOVERS, cleanUpChosenProjectLeftovers, presentWorktreeCommandError)
  ])
);
