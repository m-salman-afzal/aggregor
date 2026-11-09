export const SESSION_COMMANDS = {
  NEW_ASKING_FOR_PROJECT: "aggregorApp.newSessionAskingForProject",
  NEW_IN_CHOSEN_PROJECT: "aggregorApp.newSessionInChosenProject",
  OPEN: "aggregorApp.openSession",
  REMOVE: "aggregorApp.removeSession",
  RENAME: "aggregorApp.renameSession"
} as const;

export const SESSION_LABELS = {
  CONFIRM_REMOVE: "Remove",
  PICK_PROJECT: "Project for the new session",
  RENAME: "Session name. Leave it empty to show the agent's own title again."
} as const;

export const SESSION_NOTICES = {
  CONFIRM_REMOVE_RUNNING: (displayName: string) =>
    `Remove "${displayName}"? Its agent is still running and will be stopped.`
} as const;

export const SESSION_ERRORS = {
  LAUNCH_FAILED: "Could not open a terminal for the session.",
  NOT_FOUND: "This session no longer exists.",
  PROJECT_REQUIRED: "Add a project or open a folder to start a session.",
  // The universal VSIX, which has no aggregor-pty, still runs sessions on Windows, inside WSL.
  PTY_BINARY_NOT_FOUND: (isWindows: boolean) =>
    isWindows
      ? "On Windows, sessions run in WSL. Reopen the folder in WSL to start one."
      : "Sessions can't run on this platform yet: this build of Aggregor has no aggregor-pty for it."
} as const;
