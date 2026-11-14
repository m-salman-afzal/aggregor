import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {WORKTREE_ERRORS} from "@pkg/constants/src/git.constant.ts";
import {Array, Effect, Match} from "effect";

import type {cleanUpProjectLeftovers} from "@services/worktree.service.ts";

type WorktreeCommandError = Effect.Error<ReturnType<typeof cleanUpProjectLeftovers>>;

export const presentWorktreeCommandError = Effect.fn("WorktreePresenter.presentWorktreeCommandError")(function* (
  worktreeCommandError: WorktreeCommandError
) {
  return Match.valueTags(worktreeCommandError, {
    DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
    DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
    LeftoversKeptError: (error) => ({message: WORKTREE_ERRORS.LEFTOVERS_KEPT(Array.join(error.keptNames, ", "))}),
    NotGitRepositoryError: () => ({message: WORKTREE_ERRORS.NOT_GIT_REPOSITORY})
  });
});
