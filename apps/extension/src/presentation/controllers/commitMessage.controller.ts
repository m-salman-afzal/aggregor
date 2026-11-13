import {GenerateCommitMessageRequestDtoSchema} from "@dtos/commitMessage.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {generateCommitMessage} from "@services/commitMessage.service.ts";
import {Effect, Schema} from "effect";

const SourceControlArgumentSchema = Schema.Struct({
  rootUri: Schema.optional(Schema.Struct({fsPath: Schema.String}))
});

export const generateCommitMessageForSourceControl = Effect.fn(
  "CommitMessageController.generateCommitMessageForSourceControl"
)(function* (sourceControlArgument: unknown) {
  const vsCodeArgument = yield* decodeVsCodeArgument(SourceControlArgumentSchema, sourceControlArgument);
  const request = yield* decodeVsCodeArgument(GenerateCommitMessageRequestDtoSchema, {
    projectPath: vsCodeArgument.rootUri === undefined ? undefined : vsCodeArgument.rootUri.fsPath
  });
  yield* generateCommitMessage(request);
});
