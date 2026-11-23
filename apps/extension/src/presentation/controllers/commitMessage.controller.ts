import {Context, Effect, Layer, Schema} from "effect";

import {GenerateCommitMessageRequestDtoSchema} from "@/dtos/commitMessage.dto.ts";
import {CommitMessageErrorMessage} from "@/errorMessages/commitMessage.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {CommitMessageService} from "@/services/commitMessage.service.ts";
import {COMMIT_MESSAGE_COMMANDS} from "@pkg/constants/src/commitMessage.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

const SourceControlArgumentSchema = Schema.Struct({
  rootUri: Schema.optional(Schema.Struct({fsPath: Schema.String}))
});

export class CommitMessageController extends Context.Service<CommitMessageController>()(
  "aggregor-app/presentation/controllers/commitMessage.controller/CommitMessageController",
  {
    make: Effect.fn("CommitMessageController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const commitMessageService = yield* CommitMessageService;
      const commitMessageErrorMessage = yield* CommitMessageErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const generateCommitMessageForSourceControl = Effect.fn(
        "CommitMessageController.generateCommitMessageForSourceControl"
      )(function* (sourceControlArgument: unknown) {
        const vsCodeArgument = yield* vscodeUtils.decodeVsCodeArgument(
          SourceControlArgumentSchema,
          sourceControlArgument
        );
        const request = yield* vscodeUtils.decodeVsCodeArgument(GenerateCommitMessageRequestDtoSchema, {
          projectPath: vsCodeArgument.rootUri === undefined ? undefined : vsCodeArgument.rootUri.fsPath
        });
        yield* commitMessageService.generateCommitMessage(request);
      });

      yield* registerCommandMiddleware.registerCommand(
        COMMIT_MESSAGE_COMMANDS.GENERATE,
        generateCommitMessageForSourceControl,
        commitMessageErrorMessage.getCommitMessageCommandErrorMessage
      );

      return {generateCommitMessageForSourceControl};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([CommitMessageErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
