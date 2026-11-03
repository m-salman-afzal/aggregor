import * as ProjectController from "@/presentation/controllers/project.controller.ts";
import * as ScmController from "@/presentation/controllers/scm.controller.ts";
import * as SessionController from "@/presentation/controllers/session.controller.ts";
import {registerCommand} from "@/presentation/middlewares/register-command.ts";
import {COMMANDS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer} from "effect";

// Every command the extension contributes, by command ID.
export const RoutesLayer = Layer.effectDiscard(
  Effect.all([
    registerCommand(COMMANDS.PROJECT_ROW.NEW_SESSION, SessionController.newSessionInClickedProject),
    registerCommand(COMMANDS.PROJECT_ROW.REMOVE, ProjectController.removeProject),
    registerCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, ScmController.generateCommitMessage),
    registerCommand(COMMANDS.SESSION_ROW.OPEN, SessionController.openSession),
    registerCommand(COMMANDS.SESSION_ROW.REMOVE, SessionController.removeSession),
    registerCommand(COMMANDS.VIEW_TITLE.ADD_PROJECT, ProjectController.addProject),
    registerCommand(COMMANDS.VIEW_TITLE.NEW_SESSION, SessionController.newSessionAskingForProject)
  ])
);
