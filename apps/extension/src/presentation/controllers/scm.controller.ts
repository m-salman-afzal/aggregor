import {offerToStageAllChanges, writeCommitMessageOrShowError} from "@/application/scm/scm.service.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {ProjectPathValueObjectSchema} from "@/domain/valueObjects/projectPath.valueObject.ts";
import {setContext, withProgress} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {InvalidCommandArgumentsError} from "@/presentation/errors/registerCommand.middleware.error.ts";
import {RootUriUnavailableError} from "@/presentation/errors/scm.controller.error.ts";
import {COMMANDS, CONTEXT_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Predicate} from "effect";

import type {ProjectPathValueObject} from "@/domain/valueObjects/projectPath.valueObject.ts";

// The Source Control title button passes its SourceControl; the use cases name the project by its root folder.
const getSourceControlProjectPath = Effect.fn("ScmController.getSourceControlProjectPath")(function* (
  sourceControlArgument: unknown
) {
  const {Uri} = yield* VsCodeApi;
  if (!Predicate.hasProperty(sourceControlArgument, "rootUri")) {
    return yield* new InvalidCommandArgumentsError({cause: sourceControlArgument});
  }
  const {rootUri} = sourceControlArgument;
  if (rootUri === undefined) return yield* new RootUriUnavailableError();
  if (!(rootUri instanceof Uri)) return yield* new InvalidCommandArgumentsError({cause: rootUri});

  return ProjectPathValueObjectSchema.make(rootUri.fsPath);
});

// After Stage All, the command runs again, so the retry shows its progress too.
const stageAllAndRetry = Effect.fn("ScmController.stageAllAndRetry")(function* (
  sourceControlArgument: unknown,
  projectPath: ProjectPathValueObject
) {
  if (!(yield* offerToStageAllChanges(projectPath))) return;

  const {commands} = yield* VsCodeApi;
  yield* Effect.promise(async () =>
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
    yield* showGeneratingProgress(sourceControlArgument, yield* getSourceControlProjectPath(sourceControlArgument));
  },
  Effect.catchTag("RootUriUnavailableError", () => showErrorInBackground(COMMIT_MESSAGES.ROOT_URI_UNAVAILABLE))
);
