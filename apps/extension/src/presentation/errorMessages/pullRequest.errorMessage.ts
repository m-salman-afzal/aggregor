import {Context, Effect, Layer, Match} from "effect";

import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {WORKTREE_ERRORS} from "@pkg/constants/src/git.constant.ts";
import {GITHUB_CLI_ERRORS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";

import type {PullRequestService} from "@/services/pullRequest.service.ts";

type PullRequestCommandError = Effect.Error<
  | PullRequestService["Service"]["signInToGitHubCli"]
  | ReturnType<
      PullRequestService["Service"]["linkSessionPullRequest" | "openSessionPullRequest" | "unlinkSessionPullRequest"]
    >
>;

export class PullRequestErrorMessage extends Context.Service<PullRequestErrorMessage>()(
  "aggregor-app/presentation/errorMessages/pullRequest.errorMessage/PullRequestErrorMessage",
  {
    make: Effect.fn("PullRequestErrorMessage.make")(function* () {
      const getPullRequestCommandErrorMessage = Effect.fn("PullRequestErrorMessage.getPullRequestCommandErrorMessage")(
        function* (pullRequestCommandError: PullRequestCommandError) {
          return Match.valueTags(pullRequestCommandError, {
            DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
            DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
            InvalidSettingsError: (error) => ({message: SESSION_ERRORS.INVALID_SETTINGS(error.reason)}),
            NotGitRepositoryError: () => ({message: WORKTREE_ERRORS.NOT_GIT_REPOSITORY}),
            PullRequestNotFoundError: () => ({message: GITHUB_CLI_ERRORS.PULL_REQUEST_NOT_FOUND}),
            SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
            SessionNotInWorktreeError: () => ({message: WORKTREE_ERRORS.NOT_IN_WORKTREE})
          });
        }
      );

      return {getPullRequestCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
