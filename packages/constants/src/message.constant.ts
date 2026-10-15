export const ACTIONS = {
  REMOVE: "Remove",
  STAGE_ALL: "Stage All & Generate"
} as const;

export const COMMIT_MESSAGES = {
  CLAUDE_CLI_FAILED: (reason: string) => `Could not run the Claude CLI: ${reason}`,
  COMMIT_CLI_FAILED: (exitCode: number, stderr: string) => `Commit command exited with code ${exitCode}. ${stderr}`,
  COMMIT_FAILED: "Commit failed. Check the Git output for details.",
  EMPTY_COMMIT_MESSAGE: "Commit command printed an empty message.",
  GENERATING: "Generating commit message...",
  GIT_DIFF_FAILED: "Could not read the staged diff.",
  GIT_EXTENSION_DISABLED: "The built-in Git extension is disabled. Enable it and try again.",
  GIT_EXTENSION_UNAVAILABLE: "The built-in Git extension was not found.",
  GIT_REPOSITORY_UNAVAILABLE: "No Git repository found for this source control.",
  INVALID_SETTINGS: (reason: string) => `Invalid settings: ${reason}`,
  NOTHING_STAGED: "Nothing is staged.",
  ROOT_URI_UNAVAILABLE: "This source control has no root folder."
} as const;

export const SESSION_LABELS = {
  ACCESSIBLE: (label: string, folder: string, status: string | undefined) =>
    status === undefined ? `${label}, ${folder}` : `${label}, ${folder}, ${status}`,
  OPEN_SESSION: "Open Session",
  TOOLTIP: (name: string, cwd: string, status: string | undefined) =>
    status === undefined ? `${name}\n${cwd}` : `${name} · ${status}\n${cwd}`
} as const;

export const STATUS_LABELS = {
  exited: "exited",
  idle: "idle",
  "needs-input": "needs input",
  running: "running",
  unread: "finished"
} as const;

export const SESSION_MESSAGES = {
  CONFIRM_REMOVE_RUNNING: (name: string) => `Remove "${name}"? Its agent is still running and will be stopped.`,
  FOLDER_REQUIRED: "Open a folder to start a session.",
  LAUNCH_FAILED: "Could not open a terminal for the session.",
  NOT_FOUND: "This session no longer exists.",
  SAVE_FAILED: "Could not save sessions.",
  UNREADABLE: "Saved sessions could not be read. They may come from a newer version; reload the window."
} as const;
