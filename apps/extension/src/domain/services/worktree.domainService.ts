import {Context, Effect, Layer, String} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

const WORKTREE_BRANCH_PREFIX = "aggregor/";
const NAME_SEPARATOR_PATTERN = /[^\da-z]+/gu;
const EDGE_SEPARATOR_PATTERN = /^-+|-+$/gu;
const PROJECT_ID_SUFFIX_LENGTH = 6;
const TITLED_NAME_MAX_LENGTH = 50;
const LAST_WORD_PART_PATTERN = /-[^-]*$/u;

export class WorktreeDomainService extends Context.Service<WorktreeDomainService>()(
  "aggregor-app/domain/services/worktree.domainService/WorktreeDomainService",
  {
    make: Effect.fn("WorktreeDomainService.make")(function* () {
      const formatTextAsNamePart = Effect.fn("WorktreeDomainService.formatTextAsNamePart")(function* (text: string) {
        return String.replace(
          EDGE_SEPARATOR_PATTERN,
          ""
        )(String.replace(NAME_SEPARATOR_PATTERN, "-")(String.toLowerCase(text)));
      });

      const getWorktreeName = Effect.fn("WorktreeDomainService.getWorktreeName")(function* (sessionName: string) {
        return yield* formatTextAsNamePart(sessionName);
      });

      const getWorktreeBranchName = Effect.fn("WorktreeDomainService.getWorktreeBranchName")(function* (
        worktreeName: string
      ) {
        return `${WORKTREE_BRANCH_PREFIX}${worktreeName}`;
      });

      const getWorktreesFolderName = Effect.fn("WorktreeDomainService.getWorktreesFolderName")(function* (
        projectName: string,
        projectId: EntityIdValueObject
      ) {
        return `${yield* formatTextAsNamePart(projectName)}-${String.slice(-PROJECT_ID_SUFFIX_LENGTH)(projectId)}`;
      });

      const getTitledBranchName = Effect.fn("WorktreeDomainService.getTitledBranchName")(function* (
        sessionTitle: string
      ) {
        const titleName = yield* formatTextAsNamePart(sessionTitle);
        if (titleName.length <= TITLED_NAME_MAX_LENGTH) return `${WORKTREE_BRANCH_PREFIX}${titleName}`;
        const cutName = String.slice(0, TITLED_NAME_MAX_LENGTH)(titleName);
        const wordName = String.replace(LAST_WORD_PART_PATTERN, "")(cutName);

        return `${WORKTREE_BRANCH_PREFIX}${wordName}`;
      });

      const hasWorktreeBranchFirstName = Effect.fn("WorktreeDomainService.hasWorktreeBranchFirstName")(function* (
        branchName: string,
        worktreeFolderName: string
      ) {
        return branchName === `${WORKTREE_BRANCH_PREFIX}${worktreeFolderName}`;
      });

      return {
        formatTextAsNamePart,
        getTitledBranchName,
        getWorktreeBranchName,
        getWorktreeName,
        getWorktreesFolderName,
        hasWorktreeBranchFirstName
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
