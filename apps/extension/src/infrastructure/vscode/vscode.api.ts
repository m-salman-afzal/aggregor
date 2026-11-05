import {Context, Effect, Layer} from "effect";
import * as vscode from "vscode";

// The only runtime import of `vscode`. Everything else yields VsCodeApi and imports vscode types only.
export class VsCodeApi extends Context.Service<
  VsCodeApi,
  {
    readonly commands: typeof vscode.commands;
    readonly EventEmitter: typeof vscode.EventEmitter;
    readonly extensions: typeof vscode.extensions;
    readonly extensionUri: vscode.Uri;
    readonly FileDecoration: typeof vscode.FileDecoration;
    readonly getConfiguration: (settingsSection: string) => Effect.Effect<vscode.WorkspaceConfiguration>;
    readonly globalState: vscode.Memento;
    readonly globalStorageUri: vscode.Uri;
    readonly ProgressLocation: typeof vscode.ProgressLocation;
    readonly TabInputTerminal: typeof vscode.TabInputTerminal;
    readonly ThemeColor: typeof vscode.ThemeColor;
    readonly ThemeIcon: typeof vscode.ThemeIcon;
    readonly TreeItem: typeof vscode.TreeItem;
    readonly TreeItemCollapsibleState: typeof vscode.TreeItemCollapsibleState;
    readonly Uri: typeof vscode.Uri;
    readonly ViewColumn: typeof vscode.ViewColumn;
    readonly window: typeof vscode.window;
    readonly workspace: typeof vscode.workspace;
    readonly workspaceState: vscode.Memento;
  }
>()("aggregor-app/infrastructure/vscode/vscode.api/VsCodeApi") {
  public static readonly layer = (extensionContext: vscode.ExtensionContext) =>
    Layer.succeed(VsCodeApi, {
      commands: vscode.commands,
      EventEmitter: vscode.EventEmitter,
      extensions: vscode.extensions,
      extensionUri: extensionContext.extensionUri,
      FileDecoration: vscode.FileDecoration,
      getConfiguration: (settingsSection) => Effect.sync(() => vscode.workspace.getConfiguration(settingsSection)),
      globalState: extensionContext.globalState,
      globalStorageUri: extensionContext.globalStorageUri,
      ProgressLocation: vscode.ProgressLocation,
      TabInputTerminal: vscode.TabInputTerminal,
      ThemeColor: vscode.ThemeColor,
      ThemeIcon: vscode.ThemeIcon,
      TreeItem: vscode.TreeItem,
      TreeItemCollapsibleState: vscode.TreeItemCollapsibleState,
      Uri: vscode.Uri,
      ViewColumn: vscode.ViewColumn,
      window: vscode.window,
      workspace: vscode.workspace,
      workspaceState: extensionContext.workspaceState
    });
}
