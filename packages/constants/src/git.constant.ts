export const GIT_EXTENSION = {
  API_VERSION: 1,
  ID: "vscode.git"
} as const;

export const GIT_COMMAND = {
  COMMAND: "git",
  PORCELAIN_BRANCH_PREFIX: "branch refs/heads/",
  PORCELAIN_WORKTREE_PREFIX: "worktree "
} as const;

export const WORKTREES = {
  FOLDER_NAME: "worktrees",
  // The convention Claude Code, Conductor and Orca read: gitignore patterns of untracked files a new worktree gets.
  INCLUDE_FILE: ".worktreeinclude",
  MAX_NAME_SUFFIX: 50
} as const;

export const WORKTREE_ERRORS = {
  CREATE_FAILED: (gitError: string) => `Could not create the session's worktree: ${gitError}`,
  NOT_FOUND: "That worktree no longer exists."
} as const;
