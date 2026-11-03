import * as RepoController from "@/presentation/controllers/repo.controller.ts";
import * as ScmController from "@/presentation/controllers/scm.controller.ts";
import * as SessionController from "@/presentation/controllers/session.controller.ts";
import {registerCommand} from "@/presentation/middlewares/register-command.ts";
import {COMMANDS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer} from "effect";

// Every command the extension contributes, by command ID.
export const RoutesLayer = Layer.effectDiscard(
  Effect.all([
    registerCommand(COMMANDS.REPO_ROW.NEW_SESSION, SessionController.newSessionInClickedRepo),
    registerCommand(COMMANDS.REPO_ROW.REMOVE, RepoController.removeRepo),
    registerCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, ScmController.generateCommitMessage),
    registerCommand(COMMANDS.SESSION_ROW.OPEN, SessionController.openSession),
    registerCommand(COMMANDS.SESSION_ROW.REMOVE, SessionController.removeSession),
    registerCommand(COMMANDS.VIEW_TITLE.ADD_REPO, RepoController.addRepo),
    registerCommand(COMMANDS.VIEW_TITLE.NEW_SESSION, SessionController.newSessionAskingForRepo)
  ])
);
