import {Context, Effect, Layer} from "effect";
import {
  commands,
  env,
  EventEmitter,
  extensions,
  FileDecoration,
  ProgressLocation,
  TabInputTerminal,
  ThemeColor,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  ViewColumn,
  window,
  workspace
} from "vscode";

import type {ExtensionContext, WorkspaceConfiguration} from "vscode";

// The only runtime import of `vscode`. Everything else yields VsCodeApi and imports vscode types only.
export class VsCodeApi extends Context.Service<
  VsCodeApi,
  {
    readonly commands: typeof commands;
    readonly env: typeof env;
    readonly EventEmitter: typeof EventEmitter;
    readonly extensions: typeof extensions;
    readonly extensionUri: Uri;
    readonly FileDecoration: typeof FileDecoration;
    readonly getConfiguration: (settingsSection: string) => Effect.Effect<WorkspaceConfiguration>;
    readonly ProgressLocation: typeof ProgressLocation;
    readonly TabInputTerminal: typeof TabInputTerminal;
    readonly ThemeColor: typeof ThemeColor;
    readonly ThemeIcon: typeof ThemeIcon;
    readonly TreeItem: typeof TreeItem;
    readonly TreeItemCollapsibleState: typeof TreeItemCollapsibleState;
    readonly Uri: typeof Uri;
    readonly ViewColumn: typeof ViewColumn;
    readonly window: typeof window;
    readonly workspace: typeof workspace;
  }
>()("@pkg/vscode/vscode.api/VsCodeApi") {
  public static readonly layer = (extensionContext: ExtensionContext) =>
    Layer.succeed(VsCodeApi, {
      commands,
      env,
      EventEmitter,
      extensions,
      extensionUri: extensionContext.extensionUri,
      FileDecoration,
      getConfiguration: (settingsSection) => Effect.sync(() => workspace.getConfiguration(settingsSection)),
      ProgressLocation,
      TabInputTerminal,
      ThemeColor,
      ThemeIcon,
      TreeItem,
      TreeItemCollapsibleState,
      Uri,
      ViewColumn,
      window,
      workspace
    });
}
