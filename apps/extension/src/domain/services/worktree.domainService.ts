import {Effect, String} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

const WORKTREE_BRANCH_PREFIX = "aggregor/";
const NAME_SEPARATOR_PATTERN = /[^\da-z]+/gu;
const EDGE_SEPARATOR_PATTERN = /^-+|-+$/gu;
const PROJECT_ID_SUFFIX_LENGTH = 6;

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
