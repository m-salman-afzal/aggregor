// A worktree's path and a branch's name could read alike, so each key says which it is.
export const LEFTOVER_ROW_KEYS = {
  BRANCH: (branchName: string) => `branch:${branchName}`,
  WORKTREE: (worktreePath: string) => `worktree:${worktreePath}`
} as const;
