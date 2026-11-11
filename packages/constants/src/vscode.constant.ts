// VS Code's own commands the extension runs.
export const VS_CODE_COMMANDS = {
  OPEN_FOLDER: "vscode.openFolder",
  OPEN_SETTINGS: "workbench.action.openSettings",
  RENAME_ACTIVE_TERMINAL: "workbench.action.terminal.renameWithArg",
  SET_CONTEXT: "setContext"
} as const;

// The Settings editor's search for one extension's settings, before the extension's id.
export const SETTINGS_EDITOR_EXTENSION_FILTER = "@ext:";
