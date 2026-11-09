export const COMMIT_MESSAGE_COMMANDS = {
  GENERATE: "aggregorApp.generateCommitMessage"
} as const;

// True while a commit message is being written, so the Source Control button can show it.
export const COMMIT_MESSAGE_CONTEXT_KEYS = {
  IS_GENERATING: "aggregorApp.isGeneratingCommitMessage"
} as const;

export const COMMIT_MESSAGE_LABELS = {
  GENERATING: "Generating commit message...",
  STAGE_ALL: "Stage All & Generate"
} as const;

export const COMMIT_MESSAGE_NOTICES = {
  NOTHING_STAGED: "Nothing is staged."
} as const;

export const COMMIT_MESSAGE_ERRORS = {
  CLAUDE_CLI_FAILED: (reason: string) => `Could not run the Claude CLI: ${reason}`,
  COMMIT_CLI_FAILED: (exitCode: number, stderr: string) => `Commit command exited with code ${exitCode}. ${stderr}`,
  COMMIT_FAILED: "Commit failed. Check the Git output for details.",
  EMPTY_COMMIT_MESSAGE: "Commit command printed an empty message.",
  GIT_DIFF_FAILED: "Could not read the staged diff.",
  GIT_EXTENSION_DISABLED: "The built-in Git extension is disabled. Enable it and try again.",
  GIT_EXTENSION_UNAVAILABLE: "The built-in Git extension was not found.",
  GIT_REPOSITORY_UNAVAILABLE: "No Git repository found for this source control.",
  INVALID_SETTINGS: (reason: string) => `Invalid settings: ${reason}`,
  NOTHING_STAGED: "Nothing is staged, even after staging everything.",
  SOURCE_CONTROL_ROOT_NOT_FOUND: "This source control has no root folder."
} as const;
