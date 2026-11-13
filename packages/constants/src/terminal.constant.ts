export const TERMINAL_COMMANDS = {
  NEW_PROJECT_TERMINAL: "aggregorApp.newProjectTerminal"
} as const;

// Release VSIXs carry the one for their platform.
export const PTY_BINARY = "bin/aggregor-pty";

// Every session terminal carries its session id, so a restarted extension host can tell which tab is whose.
export const SESSION_ID_ENV = "AGGREGOR_SESSION_ID";

// Switching tabs fires the tab and active-terminal events separately and in either order, so they settle first.
export const VIEWED_SESSION_SETTLE_INTERVAL = "100 millis";

export const TERMINAL_LABELS = {
  PICK_PROJECT: "Project for the new terminal"
} as const;

export const TERMINAL_ERRORS = {
  LAUNCH_FAILED: "Could not open a terminal in the project.",
  PROJECT_REQUIRED: "Add a project or open a folder to open a terminal in it."
} as const;
