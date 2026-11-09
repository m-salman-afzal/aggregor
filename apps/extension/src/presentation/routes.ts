import {generateCommitMessageForSourceControl} from "@controllers/commitMessage.controller.ts";
import {
  addProjectsAskingForFolders,
  newProjectTerminalAskingForProject,
  removeChosenProject
} from "@controllers/project.controller.ts";
import {
  newSessionAskingForProject,
  newSessionInChosenProject,
  openChosenSession,
  removeChosenSession,
  renameChosenSession
} from "@controllers/session.controller.ts";
import {registerCommand} from "@middlewares/registerCommand.middleware.ts";
import {COMMIT_MESSAGE_COMMANDS} from "@pkg/constants/src/commitMessage.constant.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {TERMINAL_COMMANDS} from "@pkg/constants/src/terminal.constant.ts";
import {presentCommitMessageCommandError} from "@presenters/commitMessage.presenter.ts";
import {presentProjectCommandError} from "@presenters/project.presenter.ts";
import {presentSessionCommandError} from "@presenters/session.presenter.ts";
import {Effect, Layer} from "effect";

// Every command the extension contributes: its ID, its controller, and the presenter for its failures.
export const RoutesLayer = Layer.effectDiscard(
  Effect.all([
    registerCommand(
      COMMIT_MESSAGE_COMMANDS.GENERATE,
      generateCommitMessageForSourceControl,
      presentCommitMessageCommandError
    ),
    registerCommand(PROJECT_COMMANDS.ADD, addProjectsAskingForFolders, presentProjectCommandError),
    registerCommand(PROJECT_COMMANDS.REMOVE, removeChosenProject, presentProjectCommandError),
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
