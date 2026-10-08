import {Context, Effect, Layer} from "effect";
import * as vscode from "vscode";

export class VscService extends Context.Service<
  VscService,
  {readonly getConfiguration: (section: string) => Effect.Effect<vscode.WorkspaceConfiguration>}
>()("aggregor/services/vsc.service/VscService") {
  public static readonly layer = Layer.succeed(VscService, {
    getConfiguration: (section) => Effect.sync(() => vscode.workspace.getConfiguration(section))
  });
}
