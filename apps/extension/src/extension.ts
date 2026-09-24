import {writeCommitMessage} from "@/services/gitCommit.service.ts";
import {NodeServices} from "@effect/platform-node";
import {Effect} from "effect";
import * as vsc from "vscode";

const activate = (ctx: vsc.ExtensionContext) => {
  const d1 = vsc.commands.registerCommand("aggregor.generateCommitMessage", async (scm: vsc.SourceControl) => {
    await vsc.commands.executeCommand("setContext", "aggregor.isGeneratingCommitMessage", true);

    await vsc.window.withProgress(
      {location: vsc.ProgressLocation.SourceControl, title: "Generating commit message..."},

      async () => {
        await Effect.runPromise(writeCommitMessage(scm).pipe(Effect.provide(NodeServices.layer)));
        await vsc.commands.executeCommand("setContext", "aggregor.isGeneratingCommitMessage", false);
      }
    );
  });

  ctx.subscriptions.push(d1);
};

const deactivate = () => {
  /* Empty */
};

export {activate, deactivate};
