import {Context, Effect, Layer} from "effect";
import {
  commands,
  CommentMode,
  comments,
  ConfigurationTarget,
  DataTransferItem,
  env,
  EventEmitter,
  extensions,
  FileDecoration,
  LogLevel,
  ProgressLocation,
  Range,
  TabInputTerminal,
  TerminalExitReason,
  TerminalProfile,
  ThemeColor,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit
} from "vscode";

import type {ExtensionContext, WorkspaceConfiguration} from "vscode";

export class VsCodeApi extends Context.Service<
  VsCodeApi,
  {
    readonly commands: typeof commands;
    readonly CommentMode: typeof CommentMode;
    readonly comments: typeof comments;
    readonly ConfigurationTarget: typeof ConfigurationTarget;
    readonly DataTransferItem: typeof DataTransferItem;
    readonly env: typeof env;
    readonly EventEmitter: typeof EventEmitter;
    readonly extensionId: string;
    readonly extensions: typeof extensions;
    readonly extensionUri: Uri;
    readonly FileDecoration: typeof FileDecoration;
    readonly getConfiguration: (settingsSection: string) => Effect.Effect<WorkspaceConfiguration>;
    readonly LogLevel: typeof LogLevel;
    readonly ProgressLocation: typeof ProgressLocation;
    readonly Range: typeof Range;
    readonly TabInputTerminal: typeof TabInputTerminal;
    readonly TerminalExitReason: typeof TerminalExitReason;
    readonly TerminalProfile: typeof TerminalProfile;
    readonly ThemeColor: typeof ThemeColor;
    readonly ThemeIcon: typeof ThemeIcon;
    readonly TreeItem: typeof TreeItem;
    readonly TreeItemCollapsibleState: typeof TreeItemCollapsibleState;
    readonly Uri: typeof Uri;
    readonly ViewColumn: typeof ViewColumn;
    readonly window: typeof window;
    readonly workspace: typeof workspace;
    readonly WorkspaceEdit: typeof WorkspaceEdit;
  }
>()("@pkg/vscode/vscode.api/VsCodeApi") {
  public static readonly layer = (extensionContext: ExtensionContext) =>
    Layer.succeed(VsCodeApi, {
      commands,
      CommentMode,
      comments,
      ConfigurationTarget,
      DataTransferItem,
      env,
      EventEmitter,
      extensionId: extensionContext.extension.id,
      extensions,
      extensionUri: extensionContext.extensionUri,
      FileDecoration,
      getConfiguration: (settingsSection) => Effect.sync(() => workspace.getConfiguration(settingsSection)),
      LogLevel,
      ProgressLocation,
      Range,
      TabInputTerminal,
      TerminalExitReason,
      TerminalProfile,
      ThemeColor,
      ThemeIcon,
      TreeItem,
      TreeItemCollapsibleState,
      Uri,
      ViewColumn,
      window,
      workspace,
      WorkspaceEdit
    });
}
