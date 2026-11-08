import {
  addProjectsAskingForFolders,
  newProjectTerminalAskingForProject,
  removeChosenProject
} from "@controllers/project.controller.ts";
import {generateCommitMessage} from "@controllers/scm.controller.ts";
import {
  newSessionAskingForProject,
  newSessionInChosenProject,
  openChosenSession,
  removeChosenSession,
  renameChosenSession
} from "@controllers/session.controller.ts";
import {registerCommand} from "@middlewares/registerCommand.middleware.ts";
import {COMMANDS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer} from "effect";

// Every command the extension contributes, by command ID.
export const RoutesLayer = Layer.effectDiscard(
  Effect.all([
    registerCommand(COMMANDS.PROJECT_ROW.NEW_SESSION, newSessionInChosenProject),
    registerCommand(COMMANDS.PROJECT_ROW.REMOVE, removeChosenProject),
    registerCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, generateCommitMessage),
    registerCommand(COMMANDS.SESSION_ROW.OPEN, openChosenSession),
    registerCommand(COMMANDS.SESSION_ROW.REMOVE, removeChosenSession),
    registerCommand(COMMANDS.SESSION_ROW.RENAME, renameChosenSession),
    registerCommand(COMMANDS.TERMINAL_TITLE.NEW_PROJECT_TERMINAL, newProjectTerminalAskingForProject),
    registerCommand(COMMANDS.VIEW_TITLE.ADD_PROJECT, addProjectsAskingForFolders),
    registerCommand(COMMANDS.VIEW_TITLE.NEW_SESSION, newSessionAskingForProject)
  ])
);
