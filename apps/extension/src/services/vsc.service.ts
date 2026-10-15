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
    readonly FileDecoration: typeof vscode.FileDecoration;
    readonly getConfiguration: (section: string) => Effect.Effect<vscode.WorkspaceConfiguration>;
    readonly globalState: vscode.Memento;
    readonly globalStorageUri: vscode.Uri;
    readonly ProgressLocation: typeof vscode.ProgressLocation;
    readonly TabInputTerminal: typeof vscode.TabInputTerminal;
    readonly ThemeColor: typeof vscode.ThemeColor;
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
      FileDecoration: vscode.FileDecoration,
      getConfiguration: (section) => Effect.sync(() => vscode.workspace.getConfiguration(section)),
      globalState: context.globalState,
      globalStorageUri: context.globalStorageUri,
      ProgressLocation: vscode.ProgressLocation,
      TabInputTerminal: vscode.TabInputTerminal,
      ThemeColor: vscode.ThemeColor,
      TreeItem: vscode.TreeItem,
      Uri: vscode.Uri,
      ViewColumn: vscode.ViewColumn,
      window: vscode.window,
      workspace: vscode.workspace
    });
}
