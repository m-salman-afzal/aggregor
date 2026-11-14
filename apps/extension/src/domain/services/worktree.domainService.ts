import {Effect, String} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

const WORKTREE_BRANCH_PREFIX = "aggregor/";
const NAME_SEPARATOR_PATTERN = /[^\da-z]+/gu;
const EDGE_SEPARATOR_PATTERN = /^-+|-+$/gu;
const PROJECT_ID_SUFFIX_LENGTH = 6;
const TITLED_NAME_MAX_LENGTH = 50;
const LAST_WORD_PART_PATTERN = /-[^-]*$/u;

const toNamePart = Effect.fn("WorktreeDomainService.toNamePart")(function* (text: string) {
  return String.replace(
    EDGE_SEPARATOR_PATTERN,
    ""
  )(String.replace(NAME_SEPARATOR_PATTERN, "-")(String.toLowerCase(text)));
});

// "jsTester #3" becomes "jstester-3": the worktree's folder, and its branch after the prefix.
export const getWorktreeName = Effect.fn("WorktreeDomainService.getWorktreeName")(function* (sessionName: string) {
  return yield* toNamePart(sessionName);
});

export const getWorktreeBranchName = Effect.fn("WorktreeDomainService.getWorktreeBranchName")(function* (
  worktreeName: string
) {
  return `${WORKTREE_BRANCH_PREFIX}${worktreeName}`;
});

// The id's end keeps two projects with the same folder name apart.
export const getWorktreesFolderName = Effect.fn("WorktreeDomainService.getWorktreesFolderName")(function* (
  projectName: string,
  projectId: EntityIdValueObject
) {
  return `${yield* toNamePart(projectName)}-${String.slice(-PROJECT_ID_SUFFIX_LENGTH)(projectId)}`;
});

// "Fix the login redirect after OAuth" becomes aggregor/fix-the-login-redirect-after-oauth, cut at a word past 50.
export const getTitledBranchName = Effect.fn("WorktreeDomainService.getTitledBranchName")(function* (
  sessionTitle: string
) {
  const titleName = yield* toNamePart(sessionTitle);
  if (titleName.length <= TITLED_NAME_MAX_LENGTH) return `${WORKTREE_BRANCH_PREFIX}${titleName}`;
  const cutName = String.slice(0, TITLED_NAME_MAX_LENGTH)(titleName);
  const wordName = String.replace(LAST_WORD_PART_PATTERN, "")(cutName);

  return `${WORKTREE_BRANCH_PREFIX}${wordName}`;
});

// A branch still named after its worktree's folder has the name Aggregor gave it, which a title may replace.
export const hasWorktreeBranchFirstName = Effect.fn("WorktreeDomainService.hasWorktreeBranchFirstName")(function* (
  branchName: string,
  worktreeFolderName: string
) {
  return branchName === `${WORKTREE_BRANCH_PREFIX}${worktreeFolderName}`;
});
