import {GenerateCommitMessageRequestDtoSchema} from "@dtos/commitMessage.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {generateCommitMessage} from "@services/commitMessage.service.ts";
import {Effect, Schema} from "effect";

// The part of a SourceControl the request needs: its root folder, which it may lack.
const SourceControlArgumentSchema = Schema.Struct({
  rootUri: Schema.optional(Schema.Struct({fsPath: Schema.String}))
});

// The Source Control title button passes its SourceControl.
export const generateCommitMessageForSourceControl = Effect.fn(
  "CommitMessageController.generateCommitMessageForSourceControl"
)(function* (sourceControlArgument: unknown) {
  const vsCodeArgument = yield* decodeVsCodeArgument(SourceControlArgumentSchema, sourceControlArgument);
  const request = yield* decodeVsCodeArgument(GenerateCommitMessageRequestDtoSchema, {
    projectPath: vsCodeArgument.rootUri === undefined ? undefined : vsCodeArgument.rootUri.fsPath
  });
  yield* generateCommitMessage(request);
});
