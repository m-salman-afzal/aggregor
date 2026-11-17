export const TERMINAL_COMMANDS = {
  OPEN_PROJECT_TERMINAL: "aggregorApp.openProjectTerminal",
  OPEN_SESSION_FOLDER_TERMINAL: "aggregorApp.openSessionFolderTerminal"
} as const;

// Release VSIXs carry the one for their platform.
export const PTY_BINARY = "bin/aggregor-pty";

// Every session terminal carries its session id, so a restarted extension host can tell which tab is whose.
export const SESSION_ID_ENV = "AGGREGOR_SESSION_ID";

// A folder's terminal carries the folder's path, so the one terminal a folder has is found again after a restart.
export const FOLDER_PATH_ENV = "AGGREGOR_FOLDER_PATH";

export const FOLDER_TERMINAL_NAME = {
  WORKTREE: (projectName: string, worktreeFolderName: string) => `${projectName} · ${worktreeFolderName}`
} as const;

export const SESSION_OPEN_PLACES = {
  OWN_TAB: "ownTab",
  SHARED_TAB: "sharedTab"
} as const;

// A tab comes to the front a moment after it is shown, and only the tab in front can be pinned.
export const SESSION_TAB_PIN_WAIT = {
  POLL_INTERVAL_MS: 50,
  TIMEOUT_MS: 5000
} as const;

// Switching tabs fires the tab and active-terminal events separately and in either order, so they settle first.
export const VIEWED_SESSION_SETTLE_INTERVAL = "100 millis";

export const TERMINAL_ERRORS = {
  LAUNCH_FAILED: "Could not open a terminal in the project."
} as const;
