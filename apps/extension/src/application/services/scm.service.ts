import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {ICommitCliInfraService} from "@interfaces/commitCli.infraService.interface.ts";
import {IGitInfraService} from "@interfaces/git.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {ACTIONS, COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// The commit command writes the message for the staged changes into Source Control, and commits when autoCommit is on.
const writeCommitMessage = Effect.fn("ScmService.writeCommitMessage")(function* (projectPath: ProjectPathValueObject) {
  const {autoCommit, commitCommand} = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSettings);
  const gitInfraService = yield* IGitInfraService;
  const stagedDiff = yield* gitInfraService.getStagedDiff(projectPath);
  const commitMessage = yield* ICommitCliInfraService.use((commitCliInfraService) =>
    commitCliInfraService.generateCommitMessage({commitCommand, projectPath, stagedDiff})
  );

  yield* gitInfraService.setCommitMessageInput(projectPath, commitMessage);
  if (autoCommit) yield* gitInfraService.commit(projectPath, commitMessage);
});

// Every failure but NothingStaged becomes a message; the caller answers NothingStaged by offering to stage everything.
export const writeCommitMessageOrShowError = Effect.fn("ScmService.writeCommitMessageOrShowError")(
  function* (projectPath: ProjectPathValueObject) {
    yield* writeCommitMessage(projectPath);
  },
  Effect.catchTags({
    CommitCliError: ({exitCode, stderr}) => showErrorInBackground(COMMIT_MESSAGES.COMMIT_CLI_FAILED(exitCode, stderr)),
    CommitCliSpawnFailedError: ({reason}) => showErrorInBackground(COMMIT_MESSAGES.CLAUDE_CLI_FAILED(reason)),
    CommitFailedError: () => showErrorInBackground(COMMIT_MESSAGES.COMMIT_FAILED),
    EmptyCommitMessageError: () => showErrorInBackground(COMMIT_MESSAGES.EMPTY_COMMIT_MESSAGE),
    GitDiffError: () => showErrorInBackground(COMMIT_MESSAGES.GIT_DIFF_FAILED),
    GitExtensionDisabledError: () => showErrorInBackground(COMMIT_MESSAGES.GIT_EXTENSION_DISABLED),
    GitExtensionUnavailableError: () => showErrorInBackground(COMMIT_MESSAGES.GIT_EXTENSION_UNAVAILABLE),
    GitRepositoryUnavailableError: () => showErrorInBackground(COMMIT_MESSAGES.GIT_REPOSITORY_UNAVAILABLE),
    InvalidSettingsError: ({reason}) => showErrorInBackground(COMMIT_MESSAGES.INVALID_SETTINGS(reason))
  })
);

// True when the user picked Stage All and everything is now staged.
export const offerToStageAllChanges = Effect.fn("ScmService.offerToStageAllChanges")(function* (
  projectPath: ProjectPathValueObject
) {
  const pickedAction = yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
    userInputPromptInfraService.showErrorMessage(COMMIT_MESSAGES.NOTHING_STAGED, ACTIONS.STAGE_ALL)
  );
  if (pickedAction !== ACTIONS.STAGE_ALL) return false;

  yield* IGitInfraService.use((gitInfraService) => gitInfraService.stageAll(projectPath));

  return true;
});
