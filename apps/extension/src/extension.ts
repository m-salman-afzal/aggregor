import {ErrorService} from "@/services/git/error.service.ts";
import {generateCommitMessage} from "@/services/git/scm.utils.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {focusSession, newSession} from "@/services/session/terminal.utils.ts";
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
    registerCommand(COMMANDS.GENERATE_COMMIT_MESSAGE, generateCommitMessage),
    registerCommand(COMMANDS.NEW_SESSION, newSession),
    registerCommand(COMMANDS.FOCUS_SESSION, focusSession)
  ])
);

const AppLayer = Layer.mergeAll(CommandsLayer, SessionsView).pipe(
  Layer.provideMerge(TerminalService.layer),
  Layer.provideMerge(SessionStore.layer),
  Layer.provideMerge(Layer.mergeAll(ErrorService.layer, SettingsService.layer, NodeServices.layer))
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
