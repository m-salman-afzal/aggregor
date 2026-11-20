import {ICommitCliInfraService} from "@interfaces/commitCli.infraService.interface.ts";
import {IGitInfraService} from "@interfaces/git.infraService.interface.ts";
import {IProgressInfraService} from "@interfaces/progress.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {COMMIT_MESSAGE_CONTEXT_KEYS, COMMIT_MESSAGE_LABELS} from "@pkg/constants/src/commitMessage.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {Context, Effect, Layer, Result} from "effect";

import type {GenerateCommitMessageRequestDto} from "@dtos/commitMessage.dto.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class CommitMessageServiceErrors extends TaggedErrors({
  SourceControlRootNotFoundError: {}
}) {}

export class CommitMessageService extends Context.Service<CommitMessageService>()(
  "aggregor-app/application/services/commitMessage.service/CommitMessageService",
  {
    make: Effect.fn("CommitMessageService.make")(function* () {
      const commitCliInfraService = yield* ICommitCliInfraService;
      const gitInfraService = yield* IGitInfraService;
      const progressInfraService = yield* IProgressInfraService;
      const settingsConfig = yield* ISettingsConfig;

      const writeCommitMessage = Effect.fn("CommitMessageService.writeCommitMessage")(function* (
        projectPath: ProjectPathValueObject
      ) {
        const settings = yield* settingsConfig.readSettings;
        const stagedDiff = yield* gitInfraService.getStagedDiff(projectPath);
        const commitMessage = yield* commitCliInfraService.generateCommitMessage({
          commitCommand: settings.commitCommand,
          projectPath,
          stagedDiff
        });

        yield* gitInfraService.setCommitMessageInput(projectPath, commitMessage);
        if (settings.autoCommit) yield* gitInfraService.commit(projectPath, commitMessage);
      });

      const writeCommitMessageShowingProgress = Effect.fn("CommitMessageService.writeCommitMessageShowingProgress")(
        function* (projectPath: ProjectPathValueObject) {
          yield* progressInfraService.runWithSourceControlProgress(
            COMMIT_MESSAGE_LABELS.GENERATING,
            COMMIT_MESSAGE_CONTEXT_KEYS.IS_GENERATING,
            writeCommitMessage(projectPath)
          );
        }
      );

      const generateCommitMessage = Effect.fn("CommitMessageService.generateCommitMessage")(function* (
        request: GenerateCommitMessageRequestDto
      ) {
        const projectPath = yield* Effect.fromResult(
          Result.fromNullishOr(request.projectPath, () =>
            CommitMessageServiceErrors.SourceControlRootNotFoundError.make()
          )
        );

        yield* writeCommitMessageShowingProgress(projectPath);
      });

      return {generateCommitMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
