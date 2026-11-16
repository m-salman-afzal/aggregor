import {
  CleanUpProjectLeftoversRequestDtoSchema,
  ListProjectBranchesRequestDtoSchema,
  ListProjectLeftoversRequestDtoSchema
} from "@dtos/worktree.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {cleanUpProjectLeftovers, listProjectBranches, listProjectLeftovers} from "@services/worktree.service.ts";
import {Effect} from "effect";

export const cleanUpChosenProjectLeftovers = Effect.fn("WorktreeController.cleanUpChosenProjectLeftovers")(function* (
  chosenLeftovers: unknown
) {
  const request = yield* decodeVsCodeArgument(CleanUpProjectLeftoversRequestDtoSchema, chosenLeftovers);
  yield* cleanUpProjectLeftovers(request);
});

export const listProjectLeftoversForSessionsView = Effect.fn("WorktreeController.listProjectLeftoversForSessionsView")(
  function* (projectPath: string) {
    const request = yield* decodeVsCodeArgument(ListProjectLeftoversRequestDtoSchema, {projectPath});

    return yield* listProjectLeftovers(request);
  }
);

export const listProjectBranchesForSessionsView = Effect.fn("WorktreeController.listProjectBranchesForSessionsView")(
  function* (projectPath: string) {
    const request = yield* decodeVsCodeArgument(ListProjectBranchesRequestDtoSchema, {projectPath});

    return yield* listProjectBranches(request);
  }
);
