export const APP_NAME = "Aggregor App";

// The folder Aggregor keeps its files in, ~/.aggregor unless this variable names another, as tests do.
export const AGGREGOR_FOLDER_ENV = "AGGREGOR_HOME";

// Every setting lives under aggregorApp.* in VS Code's settings.
export const SETTINGS_SECTION = "aggregorApp";

export const APP_COMMANDS = {
  OPEN_SETTINGS: "aggregorApp.openSettings"
} as const;

export const APP_LABELS = {
  OPEN_SETTINGS: "Open Settings"
} as const;

export const APP_ERRORS = {
  INVALID_COMMAND_ARGUMENTS: (commandId: string) => `${commandId} got unexpected arguments.`
} as const;
