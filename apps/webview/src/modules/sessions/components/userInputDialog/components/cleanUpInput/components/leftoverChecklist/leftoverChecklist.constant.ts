export const LEFTOVER_ROW_KEYS = {
  BRANCH: (branchName: string) => `branch:${branchName}`,
  WORKTREE: (worktreePath: string) => `worktree:${worktreePath}`
} as const;
