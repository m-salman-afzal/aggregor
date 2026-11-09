import {COMMIT_MESSAGE_ERRORS} from "@pkg/constants/src/commitMessage.constant.ts";
import {Effect, Match} from "effect";

import type {generateCommitMessage} from "@services/commitMessage.service.ts";

// Every failure the commit message use case returns.
type CommitMessageCommandError = Effect.Error<ReturnType<typeof generateCommitMessage>>;

// The message a failed Generate Commit Message shows the user.
export const presentCommitMessageCommandError = Effect.fn("CommitMessagePresenter.presentCommitMessageCommandError")(
  function* (commitMessageCommandError: CommitMessageCommandError) {
    return Match.valueTags(commitMessageCommandError, {
      CommitCliError: ({exitCode, stderr}) => ({message: COMMIT_MESSAGE_ERRORS.COMMIT_CLI_FAILED(exitCode, stderr)}),
      CommitCliSpawnFailedError: ({reason}) => ({message: COMMIT_MESSAGE_ERRORS.CLAUDE_CLI_FAILED(reason)}),
      CommitFailedError: () => ({message: COMMIT_MESSAGE_ERRORS.COMMIT_FAILED}),
      EmptyCommitMessageError: () => ({message: COMMIT_MESSAGE_ERRORS.EMPTY_COMMIT_MESSAGE}),
      GitDiffError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_DIFF_FAILED}),
      GitExtensionDisabledError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_EXTENSION_DISABLED}),
      GitExtensionUnavailableError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_EXTENSION_UNAVAILABLE}),
      GitRepositoryUnavailableError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_REPOSITORY_UNAVAILABLE}),
      InvalidSettingsError: ({reason}) => ({message: COMMIT_MESSAGE_ERRORS.INVALID_SETTINGS(reason)}),
      NothingStagedError: () => ({message: COMMIT_MESSAGE_ERRORS.NOTHING_STAGED}),
      SourceControlRootNotFoundError: () => ({message: COMMIT_MESSAGE_ERRORS.SOURCE_CONTROL_ROOT_NOT_FOUND})
    });
  }
);
