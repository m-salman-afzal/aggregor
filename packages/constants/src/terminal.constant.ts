export const TERMINAL_COMMANDS = {
  OPEN_PROJECT_TERMINAL: "aggregorApp.openProjectTerminal"
} as const;

// Release VSIXs carry the one for their platform.
export const PTY_BINARY = "bin/aggregor-pty";

// Every session terminal carries its session id, so a restarted extension host can tell which tab is whose.
export const SESSION_ID_ENV = "AGGREGOR_SESSION_ID";

// A project's terminal carries its project's path, so the one terminal a project has is found again after a restart.
export const PROJECT_PATH_ENV = "AGGREGOR_PROJECT_PATH";

// Switching tabs fires the tab and active-terminal events separately and in either order, so they settle first.
export const VIEWED_SESSION_SETTLE_INTERVAL = "100 millis";

export const TERMINAL_ERRORS = {
  LAUNCH_FAILED: "Could not open a terminal in the project."
} as const;
