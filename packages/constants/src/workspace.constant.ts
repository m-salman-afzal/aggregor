// anchor/ in the Aggregor folder holds Aggregor's workspace: the anchor folder, empty and hidden at folder 0, which VS
// Code names Aggregor in folder pickers, and the workspace file beside it. It sits a level down, so the window never
// watches the database.
export const AGGREGOR_WORKSPACE = {
  ANCHOR_FOLDER_NAME: "Aggregor",
  FOLDER_NAME: "anchor",
  WORKSPACE_FILE_NAME: "Aggregor.code-workspace"
} as const;

// VS Code's settings file in a workspace folder: the anchor folder's, which Aggregor writes, and each project's own.
export const FOLDER_SETTINGS_FILE = {
  FILE_NAME: "settings.json",
  FOLDER_NAME: ".vscode",
  WATCH_PATTERN: "**/.vscode/settings.json"
} as const;

// The anchor folder's own settings. Excluding every file hides its row in Explorer and touches no other folder; its
// terminal cwd set to the shown project makes New Terminal count the two folders as one, so it opens there unasked.
export const ANCHOR_FOLDER_SETTINGS = {
  EVERY_FILE_PATTERN: "**",
  EXCLUDED_FILES_KEY: "files.exclude",
  TERMINAL_CWD_KEY: "terminal.integrated.cwd"
} as const;

// A workspace with several folders reads a folder's settings file only for settings scoped to a resource, so the shown
// project's settings are synced with the workspace file, where every setting applies. There a relative path or a folder
// variable would name the anchor folder, so the copy names the project instead. The last copy, beside the workspace
// file, tells an edit on one side from one on the other. An edit keeps the file's own indentation: the first indented
// line's, else the default.
export const PROJECT_SETTINGS_SYNC = {
  COPIED_SETTINGS_FILE_NAME: "copiedProjectSettings.json",
  CURRENT_FOLDER: "./",
  DEFAULT_INDENTATION: "    ",
  EMPTY_SETTINGS_TEXT: "{}\n",
  INDENTATION_PATTERN: /^(?<indentation>[\t ]+)\S/mu,
  PARENT_FOLDER: "..",
  RELATIVE_PATH_PREFIXES: ["./", "../"],
  TAB: "\t",
  TAB_SIZE: 4,
  WORKSPACE_FILE_SETTINGS_KEY: "settings",
  // eslint-disable-next-line no-template-curly-in-string -- VS Code's variable, written as settings write it
  WORKSPACE_FOLDER_BASENAME_VARIABLE: "${workspaceFolderBasename}",
  // eslint-disable-next-line no-template-curly-in-string -- VS Code's variable, written as settings write it
  WORKSPACE_FOLDER_VARIABLE: "${workspaceFolder}"
} as const;

// The session the window showed when it reloaded to open Aggregor's workspace, beside the anchor folder. A reload takes
// seconds; an older one is left from a window that didn't reload, as when VS Code showed another window that already
// had Aggregor's workspace open.
export const SESSION_TO_REOPEN = {
  FILE_NAME: "sessionToReopen.json",
  LIFETIME_MS: 60_000
} as const;

// A project switch rewrites the workspace file's folders, and VS Code reloads them from it and tells the extension host;
// a change to folder 0 restarts the extension host instead, which never hears back.
export const WORKSPACE_FOLDERS_CHANGE = {
  FILE_KEY: "folders",
  TIMEOUT: "5 seconds"
} as const;

// Another writer's save in flight leaves a settings file unsaved for a moment, and VS Code reports a save as failed when
// another writer's edit lands while it runs, so opening one saved and saving it are tried again this often, this many
// times.
export const SETTINGS_FILE_WRITE_RETRY = {
  INTERVAL_MS: 250,
  TIMES: 8
} as const;

// Extensions that work in one workspace folder and take folder 0, the anchor folder, until told otherwise, with the
// command that tells them.
export const FOLDER_SELECT_COMMANDS = [
  {command: "mise.selectWorkspaceFolder", extensionId: "hverlin.mise-vscode"}
] as const;
