export const GIT_EXTENSION = {
  API_VERSION: 1,
  ID: "vscode.git"
} as const;

export const GIT_COMMAND = {
  BRANCH_REF_PREFIX: "refs/heads/",
  COMMAND: "git",
  // A linked worktree's .git is a file naming its folder in the repository's .git; that folder holds its HEAD.
  GITDIR_PREFIX: "gitdir: ",
  HEAD_FILE_NAME: "HEAD",
  HEAD_REF_PREFIX: "ref: refs/heads/",
  PORCELAIN_BRANCH_PREFIX: "branch refs/heads/",
  PORCELAIN_WORKTREE_PREFIX: "worktree ",
  SHORT_HASH_LENGTH: 7
} as const;

export const WORKTREES = {
  FOLDER_NAME: "worktrees",
  // The convention Claude Code, Conductor and Orca read: gitignore patterns of untracked files a new worktree gets.
  INCLUDE_FILE: ".worktreeinclude",
  MAX_NAME_SUFFIX: 50
} as const;

export const WORKTREE_ERRORS = {
  BRANCH_RENAME_FAILED: (gitError: string) => `Could not rename the session's branch: ${gitError}`,
  CREATE_FAILED: (gitError: string) => `Could not create the session's worktree: ${gitError}`,
  NOT_FOUND: "That worktree no longer exists.",
  NOT_IN_WORKTREE: "This session works in its project's root, which has no branch of its own."
} as const;
