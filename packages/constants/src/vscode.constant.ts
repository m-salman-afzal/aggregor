export const VS_CODE_COMMANDS = {
  MANAGE_WORKSPACE_TRUST: "workbench.trust.manage",
  OPEN_FOLDER: "vscode.openFolder",
  OPEN_SETTINGS: "workbench.action.openSettings",
  PIN_ACTIVE_EDITOR: "workbench.action.pinEditor",
  RELOAD_WINDOW: "workbench.action.reloadWindow",
  RENAME_ACTIVE_TERMINAL: "workbench.action.terminal.renameWithArg",
  SET_CONTEXT: "setContext"
} as const;

export const SETTINGS_EDITOR_EXTENSION_FILTER = "@ext:";

// VS Code reads it at startup, so a change shows only after a restart.
export const WORKSPACE_TRUST_SETTINGS = {
  ENABLED: "enabled",
  SECTION: "security.workspace.trust"
} as const;
