// anchor/ in the Aggregor folder holds Aggregor's workspace: the anchor folder, empty and hidden at folder 0, which VS
// Code names Aggregor in folder pickers, and the workspace file beside it. It sits a level down, so the window never
// watches the database.
export const AGGREGOR_WORKSPACE = {
  ANCHOR_FOLDER_NAME: "Aggregor",
  FOLDER_NAME: "anchor",
  WORKSPACE_FILE_NAME: "Aggregor.code-workspace"
} as const;

// The anchor folder's own settings, in VS Code's folder settings file. Excluding every file hides its row in Explorer
// and touches no other folder; its terminal cwd set to the shown project makes New Terminal count the two folders as
// one, so it opens there unasked.
export const ANCHOR_FOLDER_SETTINGS = {
  EVERY_FILE_PATTERN: "**",
  EXCLUDED_FILES_KEY: "files.exclude",
  FILE_NAME: "settings.json",
  FOLDER_NAME: ".vscode",
  TERMINAL_CWD_KEY: "terminal.integrated.cwd"
} as const;

// The session the window showed when it reloaded to open Aggregor's workspace, beside the anchor folder. A reload takes
// seconds; an older one is left from a window that didn't reload, as when VS Code showed another window that already
// had Aggregor's workspace open.
export const SESSION_TO_REOPEN = {
  FILE_NAME: "sessionToReopen.json",
  LIFETIME_MS: 60_000
} as const;

// A change to folder 0 restarts the extension host, and the update never hears back.
export const WORKSPACE_FOLDERS_UPDATE_TIMEOUT = "5 seconds";

// Extensions that work in one workspace folder and take folder 0, the anchor folder, until told otherwise, with the
// command that tells them.
export const FOLDER_SELECT_COMMANDS = [
  {command: "mise.selectWorkspaceFolder", extensionId: "hverlin.mise-vscode"}
] as const;
