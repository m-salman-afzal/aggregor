import {toMessage} from "@/services/git/commit.service.ts";
import {ErrorService} from "@/services/git/error.service.ts";
import {ScmService} from "@/services/git/scm.service.ts";
import {SettingsService} from "@/services/settings.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {NodeServices} from "@effect/platform-node";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer} from "effect";
import * as vsc from "vscode";

const CommitLayer = Layer.mergeAll(NodeServices.layer, SettingsService.layer).pipe(Layer.provide(VscService.layer));

const activate = (ctx: vsc.ExtensionContext) => {
  const d1 = vsc.commands.registerCommand("aggregor.generateCommitMessage", async (scm: vsc.SourceControl) => {
    await vsc.commands.executeCommand("setContext", "aggregor.isGeneratingCommitMessage", true);

    await vsc.window.withProgress(
      {location: vsc.ProgressLocation.SourceControl, title: "Generating commit message..."},

      async () => {
        await Effect.runPromise(
          toMessage().pipe(
            Effect.ensuring(
              Effect.promise(async () =>
                vsc.commands.executeCommand("setContext", "aggregor.isGeneratingCommitMessage", false)
              )
            ),
            Effect.provideService(ScmService, {
              scm: Effect.sync(() => scm)
            }),
            Effect.provide(CommitLayer),
            Effect.provideService(ErrorService, {
              show: (message, ...actions) =>
                Effect.promise(async () => vsc.window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions))
            })
          )
        );
      }
    );
  });

  ctx.subscriptions.push(d1);
};

const deactivate = () => {
  /* Empty */
};

export {activate, deactivate};
