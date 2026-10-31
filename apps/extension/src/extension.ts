import {ErrorService} from "@/services/error.service.ts";
import {RepoStore} from "@/services/repo/repo.service.ts";
import {addRepo, removeRepo} from "@/services/repo/repo.utils.ts";
import {generateCommitMessage, GitReposLayer} from "@/services/scm/scm.utils.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {newSession, openSession, removeSession} from "@/services/session/terminal.utils.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {SettingsService} from "@/services/settings.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {registerCommand} from "@/services/vsc.utils.ts";
import {SessionsView} from "@/views/sessions.view.ts";
import {NodeServices} from "@effect/platform-node";
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
    // VS Code passes title-bar buttons the focused row, so drop the args and always ask for the repo.
    registerCommand(COMMANDS.VIEW_TITLE.NEW_SESSION, () => newSession())
  ])
);

const IndependentLayers = Layer.mergeAll(ErrorService.layer, SettingsService.layer, NodeServices.layer);

const AppLayer = Layer.mergeAll(CommandsLayer, GitReposLayer, SessionsView).pipe(
  Layer.provideMerge(TerminalService.layer),
  Layer.provideMerge(StatusService.layer),
  Layer.provideMerge(TranscriptService.layer),
  Layer.provideMerge(SessionStore.layer),
  Layer.provideMerge(RepoStore.layer),
  Layer.provideMerge(IndependentLayers)
);

const activate = async (ctx: ExtensionContext) => {
  const runtime = ManagedRuntime.make(AppLayer.pipe(Layer.provideMerge(VscService.layer(ctx))));
  ctx.subscriptions.push({dispose: async () => runtime.dispose()});
  // The runtime builds lazily; build it now so commands and views exist before activation finishes.
  await runtime.context();
};

const deactivate = () => {
  /* Empty */
};

export {activate, deactivate};
