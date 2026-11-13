import {ICommitCliInfraService} from "@interfaces/commitCli.infraService.interface.ts";
import {IGitInfraService} from "@interfaces/git.infraService.interface.ts";
import {IProgressInfraService} from "@interfaces/progress.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {
  COMMIT_MESSAGE_CONTEXT_KEYS,
  COMMIT_MESSAGE_LABELS,
  COMMIT_MESSAGE_NOTICES
} from "@pkg/constants/src/commitMessage.constant.ts";
import {Effect, Result, Schema} from "effect";

import type {GenerateCommitMessageRequestDto} from "@dtos/commitMessage.dto.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// The Source Control has no root folder, so it names no project to write a message for.
export class SourceControlRootNotFoundError extends Schema.TaggedError<
  SourceControlRootNotFoundError,
  {readonly brand: unique symbol}
>()("SourceControlRootNotFoundError", {}) {}

// The commit command writes the message for the staged changes into Source Control, and commits when autoCommit is on.
const writeCommitMessage = Effect.fn("CommitMessageService.writeCommitMessage")(function* (
  projectPath: ProjectPathValueObject
) {
  const settings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSettings);
  const gitInfraService = yield* IGitInfraService;
  const stagedDiff = yield* gitInfraService.getStagedDiff(projectPath);
  const commitMessage = yield* ICommitCliInfraService.use((commitCliInfraService) =>
    commitCliInfraService.generateCommitMessage({commitCommand: settings.commitCommand, projectPath, stagedDiff})
  );

  yield* gitInfraService.setCommitMessageInput(projectPath, commitMessage);
  if (settings.autoCommit) yield* gitInfraService.commit(projectPath, commitMessage);
});

const writeCommitMessageShowingProgress = Effect.fn("CommitMessageService.writeCommitMessageShowingProgress")(
  function* (projectPath: ProjectPathValueObject) {
    yield* IProgressInfraService.use((progressInfraService) =>
      progressInfraService.withSourceControlProgress(
        COMMIT_MESSAGE_LABELS.GENERATING,
        COMMIT_MESSAGE_CONTEXT_KEYS.IS_GENERATING,
        writeCommitMessage(projectPath)
      )
    );
  }
);

// True when the user picked Stage All and everything is now staged.
const offerToStageAllChanges = Effect.fn("CommitMessageService.offerToStageAllChanges")(function* (
  projectPath: ProjectPathValueObject
) {
  const pickedAction = yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
    userInputPromptInfraService.showErrorMessage(COMMIT_MESSAGE_NOTICES.NOTHING_STAGED, COMMIT_MESSAGE_LABELS.STAGE_ALL)
  );
  if (pickedAction !== COMMIT_MESSAGE_LABELS.STAGE_ALL) return false;

  yield* IGitInfraService.use((gitInfraService) => gitInfraService.stageAll(projectPath));

  return true;
});

// The offer waits on the user after the first progress ends; staging everything and still finding nothing fails.
const stageAllAndWriteCommitMessage = Effect.fn("CommitMessageService.stageAllAndWriteCommitMessage")(function* (
  projectPath: ProjectPathValueObject
) {
  if (!(yield* offerToStageAllChanges(projectPath))) return;

  yield* writeCommitMessageShowingProgress(projectPath);
});

// With nothing staged, offers to stage every change and writes the message for them.
export const generateCommitMessage = Effect.fn("CommitMessageService.generateCommitMessage")(function* (
  request: GenerateCommitMessageRequestDto
) {
  const projectPath = yield* Effect.fromResult(
    Result.fromNullishOr(request.projectPath, () => SourceControlRootNotFoundError.make())
  );

  yield* Effect.catchTag(writeCommitMessageShowingProgress(projectPath), "NothingStagedError", () =>
    stageAllAndWriteCommitMessage(projectPath)
  );
});
