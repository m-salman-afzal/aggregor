import {Array, Context, Effect, Layer, Match} from "effect";

import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {WORKTREE_ERRORS} from "@pkg/constants/src/git.constant.ts";

import type {WorktreeService} from "@/services/worktree.service.ts";

type WorktreeCommandError = Effect.Error<ReturnType<WorktreeService["Service"]["cleanUpProjectLeftovers"]>>;

export class WorktreeErrorMessage extends Context.Service<WorktreeErrorMessage>()(
  "aggregor-app/presentation/errorMessages/worktree.errorMessage/WorktreeErrorMessage",
  {
    make: Effect.fn("WorktreeErrorMessage.make")(function* () {
      const getWorktreeCommandErrorMessage = Effect.fn("WorktreeErrorMessage.getWorktreeCommandErrorMessage")(
        function* (worktreeCommandError: WorktreeCommandError) {
          return Match.valueTags(worktreeCommandError, {
            DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
            DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
            LeftoversKeptError: (error) => ({
              message: WORKTREE_ERRORS.LEFTOVERS_KEPT(Array.join(error.keptNames, ", "))
            }),
            NotGitRepositoryError: () => ({message: WORKTREE_ERRORS.NOT_GIT_REPOSITORY})
          });
        }
      );

      return {getWorktreeCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
