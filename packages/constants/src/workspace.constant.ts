// It sits a level down from the Aggregor folder, so the window never watches the database.
export const AGGREGOR_WORKSPACE = {
  ANCHOR_FOLDER_NAME: "Aggregor",
  FOLDER_NAME: "anchor",
  WORKSPACE_FILE_NAME: "Aggregor.code-workspace"
} as const;

export const FOLDER_SETTINGS_FILE = {
  FILE_NAME: "settings.json",
  FOLDER_NAME: ".vscode",
  WATCH_PATTERN: "**/.vscode/settings.json"
} as const;

// Excluding every file hides its row in Explorer; its terminal cwd makes New Terminal open in the shown project unasked.
export const ANCHOR_FOLDER_SETTINGS = {
  EVERY_FILE_PATTERN: "**",
  EXCLUDED_FILES_KEY: "files.exclude",
  TERMINAL_CWD_KEY: "terminal.integrated.cwd"
} as const;

// A multi-folder workspace reads a folder's settings file only for resource-scoped settings, so they sync with its file.
export const PROJECT_SETTINGS_SYNC = {
  COPIED_SETTINGS_FILE_NAME: "copiedProjectSettings.json",
  CURRENT_FOLDER: "./",
  DEFAULT_INDENTATION: "    ",
  EMPTY_SETTINGS_TEXT: "{}\n",
  // Matched against the text before a property: the spaces or tabs it starts its line with.
  INDENTATION_PATTERN: /\n(?<indentation>[\t ]+)$/u,
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

// A reload takes seconds; an older record is left from a window that didn't reload.
export const SESSION_TO_REOPEN = {
  FILE_NAME: "sessionToReopen.json",
  LIFETIME_MS: 60_000
} as const;

// A change to folder 0 restarts the extension host instead, which never hears back.
export const WORKSPACE_FOLDERS_CHANGE = {
  FILE_KEY: "folders",
  TIMEOUT: "5 seconds"
} as const;

// VS Code reports a save as failed when another writer's edit lands while it runs, so opening and saving are retried.
export const SETTINGS_FILE_WRITE_RETRY = {
  INTERVAL_MS: 250,
  TIMES: 8
} as const;

// Extensions that work in one folder take folder 0, the anchor folder, until told otherwise by their command.
export const FOLDER_SELECT_COMMANDS = [
  {command: "mise.selectWorkspaceFolder", extensionId: "hverlin.mise-vscode"}
] as const;
