import {toMessage} from "@/services/git/commit.service.ts";
import {ErrorService} from "@/services/git/error.service.ts";
import {NodeServices} from "@effect/platform-node";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {Effect} from "effect";
import * as vsc from "vscode";

const activate = (ctx: vsc.ExtensionContext) => {
  const d1 = vsc.commands.registerCommand("aggregor.generateCommitMessage", async (scm: vsc.SourceControl) => {
    await vsc.commands.executeCommand("setContext", "aggregor.isGeneratingCommitMessage", true);

    await vsc.window.withProgress(
      {location: vsc.ProgressLocation.SourceControl, title: "Generating commit message..."},

      async () => {
        await Effect.runPromise(
          toMessage(scm).pipe(
            Effect.ensuring(
              Effect.promise(async () =>
                vsc.commands.executeCommand("setContext", "aggregor.isGeneratingCommitMessage", false)
              )
            ),
            Effect.provide(NodeServices.layer),
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
