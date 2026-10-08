import {Context, Effect, Layer} from "effect";
import * as vscode from "vscode";

// The only runtime import of `vscode`. Everything else yields this service and imports vscode types only.
export class VscService extends Context.Service<
  VscService,
  {
    readonly commands: typeof vscode.commands;
    readonly EventEmitter: typeof vscode.EventEmitter;
    readonly extensions: typeof vscode.extensions;
    readonly extensionUri: vscode.Uri;
    readonly getConfiguration: (section: string) => Effect.Effect<vscode.WorkspaceConfiguration>;
    readonly ProgressLocation: typeof vscode.ProgressLocation;
    readonly TreeItem: typeof vscode.TreeItem;
    readonly Uri: typeof vscode.Uri;
    readonly ViewColumn: typeof vscode.ViewColumn;
    readonly window: typeof vscode.window;
    readonly workspace: typeof vscode.workspace;
  }
>()("aggregor/services/vsc.service/VscService") {
  /* eslint-disable sort-keys */
  public static readonly layer = (context: vscode.ExtensionContext) =>
    Layer.succeed(VscService, {
      commands: vscode.commands,
      EventEmitter: vscode.EventEmitter,
      extensions: vscode.extensions,
      extensionUri: context.extensionUri,
      getConfiguration: (section) => Effect.sync(() => vscode.workspace.getConfiguration(section)),
      ProgressLocation: vscode.ProgressLocation,
      TreeItem: vscode.TreeItem,
      Uri: vscode.Uri,
      ViewColumn: vscode.ViewColumn,
      window: vscode.window,
      workspace: vscode.workspace
    });
}
