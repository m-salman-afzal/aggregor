import {COMMIT_MESSAGE_ERRORS} from "@pkg/constants/src/commitMessage.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer, Match} from "effect";

import type {CommitMessageService} from "@services/commitMessage.service.ts";

type CommitMessageCommandError = Effect.Error<ReturnType<CommitMessageService["Service"]["generateCommitMessage"]>>;

export class CommitMessageErrorMessage extends Context.Service<CommitMessageErrorMessage>()(
  "aggregor-app/presentation/errorMessages/commitMessage.errorMessage/CommitMessageErrorMessage",
  {
    make: Effect.fn("make")(function* () {
      const getCommitMessageCommandErrorMessage = Effect.fn("getCommitMessageCommandErrorMessage")(function* (
        commitMessageCommandError: CommitMessageCommandError
      ) {
        return Match.valueTags(commitMessageCommandError, {
          CommitCliError: (error) => ({message: COMMIT_MESSAGE_ERRORS.COMMIT_CLI_FAILED(error.exitCode, error.stderr)}),
          CommitCliSpawnFailedError: (error) => ({message: COMMIT_MESSAGE_ERRORS.CLAUDE_CLI_FAILED(error.reason)}),
          CommitFailedError: () => ({message: COMMIT_MESSAGE_ERRORS.COMMIT_FAILED}),
          EmptyCommitMessageError: () => ({message: COMMIT_MESSAGE_ERRORS.EMPTY_COMMIT_MESSAGE}),
          GitDiffError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_DIFF_FAILED}),
          GitExtensionDisabledError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_EXTENSION_DISABLED}),
          GitExtensionUnavailableError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_EXTENSION_UNAVAILABLE}),
          GitRepositoryUnavailableError: () => ({message: COMMIT_MESSAGE_ERRORS.GIT_REPOSITORY_UNAVAILABLE}),
          InvalidSettingsError: (error) => ({message: COMMIT_MESSAGE_ERRORS.INVALID_SETTINGS(error.reason)}),
          NothingStagedError: () => ({message: COMMIT_MESSAGE_ERRORS.NOTHING_STAGED}),
          SourceControlRootNotFoundError: () => ({message: COMMIT_MESSAGE_ERRORS.SOURCE_CONTROL_ROOT_NOT_FOUND})
        });
      });

      return {getCommitMessageCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("CommitMessageErrorMessage", this.make()));
}
