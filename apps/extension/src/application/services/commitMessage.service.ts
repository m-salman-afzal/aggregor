import {ICommitCliInfraService} from "@interfaces/commitCli.infraService.interface.ts";
import {IGitInfraService} from "@interfaces/git.infraService.interface.ts";
import {IProgressInfraService} from "@interfaces/progress.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {COMMIT_MESSAGE_CONTEXT_KEYS, COMMIT_MESSAGE_LABELS} from "@pkg/constants/src/commitMessage.constant.ts";
import {Effect, Result, Schema} from "effect";

import type {GenerateCommitMessageRequestDto} from "@dtos/commitMessage.dto.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class SourceControlRootNotFoundError extends Schema.TaggedError<
  SourceControlRootNotFoundError,
  {readonly brand: unique symbol}
>()("SourceControlRootNotFoundError", {}) {}

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

export const generateCommitMessage = Effect.fn("CommitMessageService.generateCommitMessage")(function* (
  request: GenerateCommitMessageRequestDto
) {
  const projectPath = yield* Effect.fromResult(
    Result.fromNullishOr(request.projectPath, () => SourceControlRootNotFoundError.make())
  );

  yield* writeCommitMessageShowingProgress(projectPath);
});
