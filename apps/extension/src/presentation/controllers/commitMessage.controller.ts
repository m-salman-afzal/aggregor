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

type SourceControlArgument = typeof SourceControlArgumentSchema.Type;

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
      )(function* (sourceControlArgument: SourceControlArgument) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(GenerateCommitMessageRequestDtoSchema, {
          projectPath: sourceControlArgument.rootUri === undefined ? undefined : sourceControlArgument.rootUri.fsPath
        });
        yield* commitMessageService.generateCommitMessage(request);
      });

      yield* registerCommandMiddleware.registerCommand({
        commandId: COMMIT_MESSAGE_COMMANDS.GENERATE,
        controller: generateCommitMessageForSourceControl,
        getCommandErrorMessage: commitMessageErrorMessage.getCommitMessageCommandErrorMessage,
        requestSchema: SourceControlArgumentSchema
      });

      return {generateCommitMessageForSourceControl};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([CommitMessageErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
