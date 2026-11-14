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
  // An unreachable origin, or an ssh key waiting for its passphrase, would hold the cleanup dialog.
  PRUNE_TIMEOUT: "10 seconds",
  SHORT_HASH_LENGTH: 7
} as const;

export const WORKTREES = {
  BRANCH_PREFIX: "aggregor/",
  FOLDER_NAME: "worktrees",
  // The convention Claude Code, Conductor and Orca read: gitignore patterns of untracked files a new worktree gets.
  INCLUDE_FILE: ".worktreeinclude",
  MAX_NAME_SUFFIX: 50
} as const;

export const WORKTREE_COMMANDS = {
  CLEAN_UP_LEFTOVERS: "aggregorApp.cleanUpProjectLeftovers"
} as const;

export const WORKTREE_ERRORS = {
  BRANCH_RENAME_FAILED: (gitError: string) => `Could not rename the session's branch: ${gitError}`,
  CREATE_FAILED: (gitError: string) => `Could not create the session's worktree: ${gitError}`,
  HAS_CHANGES: "The session's worktree has changes. Commit or discard them in Source Control, then remove it.",
  LEFTOVERS_KEPT: (keptNames: string) =>
    `Kept ${keptNames}: a worktree with changes, or a branch checked out in a kept worktree, stays.`,
  NOT_FOUND: "That worktree no longer exists.",
  NOT_GIT_REPOSITORY: "This project is no git repository.",
  NOT_IN_WORKTREE: "This session works in its project's root, which has no branch of its own.",
  REMOVE_FAILED: (gitError: string) => `Could not remove the session's worktree: ${gitError}`
} as const;

export const LEFTOVER_LABELS = {
  BRANCHES_SECTION: "Branches",
  CHECKING: "Checking for merged branches…",
  CLEAN_UP: "Clean Up Worktrees…",
  DELETE: "Delete",
  HAS_CHANGES: "has changes",
  HAS_LEFTOVERS: "Worktrees or branches left over",
  IN_WORKTREE_WITH_CHANGES: "checked out in a worktree with changes",
  MERGED: (baseBranchName: string) => `merged into ${baseBranchName}`,
  NONE: "Nothing left over.",
  NOT_MERGED: "not merged",
  SELECT_ALL: "Select all",
  TITLE: (projectName: string) => `Clean up ${projectName}`,
  WORKTREES_SECTION: "Worktrees"
} as const;
