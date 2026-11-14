import {LEFTOVER_ROW_KEYS} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.constant.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {LEFTOVER_LABELS} from "@pkg/constants/src/git.constant.ts";

import type {LeftoverRowData} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.type.ts";
import type {ChosenLeftovers} from "@/modules/sessions/sessions.type.ts";
import type {ProjectLeftoversDto} from "@dtos/worktree.dto.ts";

// A worktree counts as merged when its branch does; one with changes can't be removed, so it can't be ticked.
export const toWorktreeRows = (leftovers: ProjectLeftoversDto): readonly LeftoverRowData[] => {
  const mergedBranchNames = new Set(
    leftovers.branches.filter((branch) => branch.isMerged).map((branch) => branch.branchName)
  );

  return leftovers.worktrees.map((worktree) => ({
    detail: worktree.hasChanges
      ? `${worktree.branchName}${SESSIONS_LABELS.DETAIL_SEPARATOR}${LEFTOVER_LABELS.HAS_CHANGES}`
      : worktree.branchName,
    isDisabled: worktree.hasChanges,
    isMerged: mergedBranchNames.has(worktree.branchName),
    label: worktree.worktreeName,
    rowKey: LEFTOVER_ROW_KEYS.WORKTREE(worktree.worktreePath)
  }));
};

const describeMerge = (isMerged: boolean, baseBranchName: string) =>
  isMerged ? LEFTOVER_LABELS.MERGED(baseBranchName) : LEFTOVER_LABELS.NOT_MERGED;

// A branch checked out in a worktree with changes stays with that worktree.
export const toBranchRows = (leftovers: ProjectLeftoversDto): readonly LeftoverRowData[] => {
  const keptBranchNames = new Set(
    leftovers.worktrees.filter((worktree) => worktree.hasChanges).map((worktree) => worktree.branchName)
  );

  return leftovers.branches.map((branch) => ({
    detail: keptBranchNames.has(branch.branchName)
      ? LEFTOVER_LABELS.IN_WORKTREE_WITH_CHANGES
      : describeMerge(branch.isMerged, leftovers.baseBranchName),
    isDisabled: keptBranchNames.has(branch.branchName),
    isMerged: branch.isMerged,
    label: branch.branchName,
    rowKey: LEFTOVER_ROW_KEYS.BRANCH(branch.branchName)
  }));
};

export const takeChosenLeftovers = (
  leftovers: ProjectLeftoversDto,
  tickedRowKeys: ReadonlySet<string>
): ChosenLeftovers => ({
  branchNames: leftovers.branches
    .map((branch) => branch.branchName)
    .filter((branchName) => tickedRowKeys.has(LEFTOVER_ROW_KEYS.BRANCH(branchName))),
  worktreePaths: leftovers.worktrees
    .map((worktree) => worktree.worktreePath)
    .filter((worktreePath) => tickedRowKeys.has(LEFTOVER_ROW_KEYS.WORKTREE(worktreePath)))
});

export const toggleRowKey = (tickedRowKeys: ReadonlySet<string>, rowKey: string) => {
  const nextTickedRowKeys = new Set(tickedRowKeys);
  if (!nextTickedRowKeys.delete(rowKey)) nextTickedRowKeys.add(rowKey);

  return nextTickedRowKeys;
};
