import {Context, Effect, Layer} from "effect";

import {
  CleanUpProjectLeftoversRequestDtoSchema,
  ListProjectBranchesRequestDtoSchema,
  ListProjectLeftoversRequestDtoSchema
} from "@/dtos/worktree.dto.ts";
import {WorktreeErrorMessage} from "@/errorMessages/worktree.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {WorktreeService} from "@/services/worktree.service.ts";
import {WORKTREE_COMMANDS} from "@pkg/constants/src/git.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

import type {CleanUpProjectLeftoversRequestDto} from "@/dtos/worktree.dto.ts";

export class WorktreeController extends Context.Service<WorktreeController>()(
  "aggregor-app/presentation/controllers/worktree.controller/WorktreeController",
  {
    make: Effect.fn("WorktreeController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const worktreeService = yield* WorktreeService;
      const worktreeErrorMessage = yield* WorktreeErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const cleanUpChosenProjectLeftovers = Effect.fn("WorktreeController.cleanUpChosenProjectLeftovers")(function* (
        request: CleanUpProjectLeftoversRequestDto
      ) {
        yield* worktreeService.cleanUpProjectLeftovers(request);
      });

      const listProjectLeftoversForSessionsView = Effect.fn("WorktreeController.listProjectLeftoversForSessionsView")(
        function* (projectPath: string) {
          const request = yield* vscodeUtils.decodeVsCodeArgument(ListProjectLeftoversRequestDtoSchema, {projectPath});

          return yield* worktreeService.listProjectLeftovers(request);
        }
      );

      const listProjectBranchesForSessionsView = Effect.fn("WorktreeController.listProjectBranchesForSessionsView")(
        function* (projectPath: string) {
          const request = yield* vscodeUtils.decodeVsCodeArgument(ListProjectBranchesRequestDtoSchema, {projectPath});

          return yield* worktreeService.listProjectBranches(request);
        }
      );

      yield* registerCommandMiddleware.registerCommand({
        commandId: WORKTREE_COMMANDS.CLEAN_UP_LEFTOVERS,
        controller: cleanUpChosenProjectLeftovers,
        getCommandErrorMessage: worktreeErrorMessage.getWorktreeCommandErrorMessage,
        requestSchema: CleanUpProjectLeftoversRequestDtoSchema
      });

      return {cleanUpChosenProjectLeftovers, listProjectBranchesForSessionsView, listProjectLeftoversForSessionsView};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([WorktreeErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
