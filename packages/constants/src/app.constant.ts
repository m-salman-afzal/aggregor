export const APP_NAME = "Aggregor App";

export const AGGREGOR_FOLDER = {
  DEFAULT_NAME: ".aggregor",
  ENVIRONMENT_VARIABLE: "AGGREGOR_HOME",
  MODE: 0o700
} as const;

export const SETTINGS_SECTION = "aggregorApp";

export const APP_COMMANDS = {
  OPEN_SETTINGS: "aggregorApp.openSettings"
} as const;

export const APP_LABELS = {
  CANCEL: "Cancel",
  OPEN_SETTINGS: "Open Settings"
} as const;

// Fatal has no VS Code log call of its own.
export const OUTPUT_CHANNEL_LOG_METHODS = {
  Debug: "debug",
  Error: "error",
  Fatal: "error",
  Info: "info",
  Trace: "trace",
  Warn: "warn"
} as const;

export const TRACE_LOGGING = {
  FORCED_LINE: (logMethod: string, logLine: string) => `[${logMethod}] ${logLine}`,
  LINE_BREAK_PATTERN: /\s*\n\s*/gu,
  SETTING: "traceLogging",
  SPAN_OWNER_ATTRIBUTE: "owner",
  TYPE_MARKER_PREFIX: "~",
  VALUE_DEPTH: 3
} as const;

export const TRACE_LOGGING_SETTING_ID = `${SETTINGS_SECTION}.${TRACE_LOGGING.SETTING}`;

export const APP_ERRORS = {
  INVALID_COMMAND_ARGUMENTS: (commandId: string) => `${commandId} got unexpected arguments.`
} as const;
