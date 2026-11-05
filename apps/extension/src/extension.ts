import {addRepo, removeRepo} from "@/application/repo/repo.service.ts";
import {newSession, openSession, removeSession} from "@/application/session/session.service.ts";
import {AppLayer} from "@/infrastructure/di/app.layer.ts";
import {TraceLogLayer} from "@/infrastructure/logger/trace-log.layer.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {generateCommitMessage} from "@/presentation/controllers/scm.controller.ts";
import {registerCommand} from "@/services/vscode.utils.ts";
import {SessionsView} from "@/views/sessions.view.ts";
import {COMMANDS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer, ManagedRuntime} from "effect";

import type {ExtensionContext} from "vscode";

const CommandsLayer = Layer.effectDiscard(
  Effect.all([
    registerCommand(COMMANDS.REPO_ROW.NEW_SESSION, newSession),
    registerCommand(COMMANDS.REPO_ROW.REMOVE, removeRepo),
    registerCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, generateCommitMessage),
    registerCommand(COMMANDS.SESSION_ROW.OPEN, openSession),
    registerCommand(COMMANDS.SESSION_ROW.REMOVE, removeSession),
    registerCommand(COMMANDS.VIEW_TITLE.ADD_REPO, addRepo),
    // VS Code passes title-bar buttons the focused row, so drop the arguments and always ask for the repo.
    registerCommand(COMMANDS.VIEW_TITLE.NEW_SESSION, () => newSession())
  ])
);

const activate = async (extensionContext: ExtensionContext) => {
  // TraceLogLayer goes under everything, so every layer's startup work is traced and logged too.
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(CommandsLayer, SessionsView).pipe(
      Layer.provideMerge(AppLayer),
      Layer.provide(TraceLogLayer),
      Layer.provideMerge(VsCodeService.layer(extensionContext))
    )
  );
  extensionContext.subscriptions.push({dispose: async () => runtime.dispose()});
  // The runtime builds lazily; build it now so commands and views exist before activation finishes.
  await runtime.context();
};

export {activate};
