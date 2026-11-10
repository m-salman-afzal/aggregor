import {generateCommitMessageForSourceControl} from "@controllers/commitMessage.controller.ts";
import {
  addProjectsAskingForFolders,
  moveChosenProjectDown,
  moveChosenProjectUp,
  newProjectTerminalAskingForProject,
  removeChosenProject
} from "@controllers/project.controller.ts";
import {
  moveChosenSessionDown,
  moveChosenSessionUp,
  newSessionAskingForProject,
  newSessionInChosenProject,
  openChosenSession,
  removeChosenSession,
  renameChosenSession
} from "@controllers/session.controller.ts";
import {registerCommand} from "@middlewares/registerCommand.middleware.ts";
import {APP_COMMANDS} from "@pkg/constants/src/app.constant.ts";
import {COMMIT_MESSAGE_COMMANDS} from "@pkg/constants/src/commitMessage.constant.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {TERMINAL_COMMANDS} from "@pkg/constants/src/terminal.constant.ts";
import {openAggregorSettingsInSettingsEditor} from "@pkg/vscode/src/vscode.utils.ts";
import {presentAppCommandError} from "@presenters/app.presenter.ts";
import {presentCommitMessageCommandError} from "@presenters/commitMessage.presenter.ts";
import {presentProjectCommandError} from "@presenters/project.presenter.ts";
import {presentSessionCommandError} from "@presenters/session.presenter.ts";
import {Effect, Layer} from "effect";

// Every command the extension contributes: its ID, its controller, and the presenter for its failures. Open Settings
// only drives VS Code, so it goes straight to the helper, with no controller or use case.
export const RoutesLayer = Layer.effectDiscard(
  Effect.all([
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
    registerCommand(SESSION_COMMANDS.MOVE_DOWN, moveChosenSessionDown, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.MOVE_UP, moveChosenSessionUp, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.NEW_ASKING_FOR_PROJECT, newSessionAskingForProject, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT, newSessionInChosenProject, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.OPEN, openChosenSession, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.REMOVE, removeChosenSession, presentSessionCommandError),
    registerCommand(SESSION_COMMANDS.RENAME, renameChosenSession, presentSessionCommandError),
    registerCommand(
      TERMINAL_COMMANDS.NEW_PROJECT_TERMINAL,
      newProjectTerminalAskingForProject,
      presentProjectCommandError
    )
  ])
);
