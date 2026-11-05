import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {setContext, withProgress} from "@infraUtils/vscode.utils.ts";
import {InvalidCommandArgumentsError} from "@middlewares/registerCommand.middleware.ts";
import {COMMANDS, CONTEXT_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {offerToStageAllChanges, writeCommitMessageOrShowError} from "@services/scm.service.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Predicate, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

class RootUriUnavailableError extends Schema.TaggedError<RootUriUnavailableError, {readonly brand: unique symbol}>()(
  "RootUriUnavailableError",
  {}
) {}

// The Source Control title button passes its SourceControl; the use cases name the project by its root folder.
const getSourceControlProjectPath = Effect.fn("ScmController.getSourceControlProjectPath")(function* (
  sourceControlArgument: unknown
) {
  const {Uri} = yield* VsCodeApi;
  if (!Predicate.hasProperty(sourceControlArgument, "rootUri")) {
    return yield* InvalidCommandArgumentsError.make({cause: sourceControlArgument});
  }
  const {rootUri} = sourceControlArgument;
  if (rootUri === undefined) return yield* RootUriUnavailableError.make();
  if (!(rootUri instanceof Uri)) return yield* InvalidCommandArgumentsError.make({cause: rootUri});

  return ProjectPathValueObjectSchema.make(rootUri.fsPath);
});

// After Stage All, the command runs again, so the retry shows its progress too.
const stageAllAndRetry = Effect.fn("ScmController.stageAllAndRetry")(function* (
  sourceControlArgument: unknown,
  projectPath: ProjectPathValueObject
) {
  if (!(yield* offerToStageAllChanges(projectPath))) return;

  const {commands} = yield* VsCodeApi;
  yield* Effect.promise(() =>
    commands.executeCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, sourceControlArgument)
  );
});

// The offer waits on the user, so it runs detached and the progress ends now.
const writeCommitMessageOrOfferToStage = Effect.fn("ScmController.writeCommitMessageOrOfferToStage")(
  function* (_sourceControlArgument: unknown, projectPath: ProjectPathValueObject) {
    yield* writeCommitMessageOrShowError(projectPath);
  },
  (effect, sourceControlArgument, projectPath) =>
    Effect.catchTag(effect, "NothingStagedError", () =>
      Effect.forkDetach(stageAllAndRetry(sourceControlArgument, projectPath))
    )
);

const showGeneratingProgress = Effect.fn("ScmController.showGeneratingProgress")(
  function* (sourceControlArgument: unknown, projectPath: ProjectPathValueObject) {
    const {ProgressLocation} = yield* VsCodeApi;

    yield* setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, true);
    yield* withProgress(
      {location: ProgressLocation.SourceControl, title: COMMIT_MESSAGES.GENERATING},
      writeCommitMessageOrOfferToStage(sourceControlArgument, projectPath)
    );
  },
  Effect.ensuring(setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, false))
);

export const generateCommitMessage = Effect.fn("ScmController.generateCommitMessage")(
  function* (sourceControlArgument: unknown) {
    const projectPath = yield* getSourceControlProjectPath(sourceControlArgument);
    yield* showGeneratingProgress(sourceControlArgument, projectPath);
  },
  Effect.catchTag("RootUriUnavailableError", () => showErrorInBackground(COMMIT_MESSAGES.ROOT_URI_UNAVAILABLE))
);
