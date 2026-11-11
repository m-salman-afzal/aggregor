export const APP_NAME = "Aggregor App";

// The folder Aggregor keeps its files in, which only its owner can read: ~/.aggregor unless the variable names another;
// F5's Run Extension sets ~/.aggregorDev, and tests their own.
export const AGGREGOR_FOLDER = {
  DEFAULT_NAME: ".aggregor",
  ENVIRONMENT_VARIABLE: "AGGREGOR_HOME",
  MODE: 0o700
} as const;

// Every setting lives under aggregorApp.* in VS Code's settings.
export const SETTINGS_SECTION = "aggregorApp";

export const APP_COMMANDS = {
  OPEN_SETTINGS: "aggregorApp.openSettings"
} as const;

export const APP_LABELS = {
  CANCEL: "Cancel",
  OPEN_SETTINGS: "Open Settings"
} as const;

// The trace log's VS Code log call for each of Effect's log levels; Fatal has none of its own.
export const OUTPUT_CHANNEL_LOG_METHODS = {
  Debug: "debug",
  Error: "error",
  Fatal: "error",
  Info: "info",
  Trace: "trace",
  Warn: "warn"
} as const;

// The trace logging setting writes every line the Aggregor App channel's log level would hide, at Info, led by its own
// level; a value it prints spans one line.
export const TRACE_LOGGING = {
  FORCED_LINE: (logMethod: string, logLine: string) => `[${logMethod}] ${logLine}`,
  LINE_BREAK_PATTERN: /\s*\n\s*/gu,
  SETTING: "traceLogging",
  TYPE_MARKER_PREFIX: "~",
  VALUE_DEPTH: 3
} as const;

// The trace logging setting's full id, which its changes name.
export const TRACE_LOGGING_SETTING_ID = `${SETTINGS_SECTION}.${TRACE_LOGGING.SETTING}`;

export const APP_ERRORS = {
  INVALID_COMMAND_ARGUMENTS: (commandId: string) => `${commandId} got unexpected arguments.`
} as const;
