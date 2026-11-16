import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {WORKTREE_ERRORS} from "@pkg/constants/src/git.constant.ts";
import {GITHUB_CLI, GITHUB_CLI_ERRORS, GITHUB_CLI_LABELS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {Effect, Match} from "effect";

import type {installGitHubCli, openSessionPullRequest, signInToGitHubCli} from "@services/pullRequest.service.ts";

type PullRequestCommandError = Effect.Error<
  ReturnType<typeof installGitHubCli | typeof openSessionPullRequest | typeof signInToGitHubCli>
>;

export const presentPullRequestCommandError = Effect.fn("PullRequestPresenter.presentPullRequestCommandError")(
  function* (pullRequestCommandError: PullRequestCommandError) {
    return Match.valueTags(pullRequestCommandError, {
      DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
      InvalidSettingsError: (error) => ({message: SESSION_ERRORS.INVALID_SETTINGS(error.reason)}),
      NoPackageManagerError: () => ({
        message: GITHUB_CLI_ERRORS.NO_PACKAGE_MANAGER,
        pageToOpen: {label: GITHUB_CLI_LABELS.INSTALL_PAGE, url: GITHUB_CLI.INSTALL_PAGE}
      }),
      NotGitRepositoryError: () => ({message: WORKTREE_ERRORS.NOT_GIT_REPOSITORY}),
      PullRequestNotFoundError: () => ({message: GITHUB_CLI_ERRORS.PULL_REQUEST_NOT_FOUND}),
      SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
      SessionNotInWorktreeError: () => ({message: WORKTREE_ERRORS.NOT_IN_WORKTREE})
    });
  }
);
