export const APP_NAME = "Aggregor App";

// Every setting lives under aggregorApp.* in VS Code's settings.
export const SETTINGS_SECTION = "aggregorApp";

export const APP_ERRORS = {
  INVALID_COMMAND_ARGUMENTS: (commandId: string) => `${commandId} got unexpected arguments.`
} as const;
