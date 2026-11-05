import {offerToStageAllChanges, writeCommitMessageOrShowError} from "@/application/scm/scm.service.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {setContext, withProgress} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {InvalidCommandArguments} from "@/presentation/errors/command.error.ts";
import {RootUriUnavailable} from "@/presentation/errors/scm.error.ts";
import {COMMANDS, CONTEXT_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Predicate} from "effect";

import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";

// The Source Control title button passes its SourceControl; the use cases name the repo by its root folder.
const getSourceControlRepoPath = Effect.fn("ScmController.getSourceControlRepoPath")(function* (
  sourceControlArgument: unknown
) {
  const {Uri} = yield* VsCodeService;
  if (!Predicate.hasProperty(sourceControlArgument, "rootUri")) {
    return yield* new InvalidCommandArguments({cause: sourceControlArgument});
  }
  const {rootUri} = sourceControlArgument;
  if (rootUri === undefined) return yield* new RootUriUnavailable();
  if (!(rootUri instanceof Uri)) return yield* new InvalidCommandArguments({cause: rootUri});

  return RepoPathSchema.make(rootUri.fsPath);
});

// After Stage All, the command runs again, so the retry shows its progress too.
const stageAllAndRetry = Effect.fn("ScmController.stageAllAndRetry")(function* (
  sourceControlArgument: unknown,
  repoPath: RepoPath
) {
  if (!(yield* offerToStageAllChanges(repoPath))) return;

  const {commands} = yield* VsCodeService;
  yield* Effect.promise(async () =>
    commands.executeCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, sourceControlArgument)
  );
});

// The offer waits on the user, so it runs detached and the progress ends now.
const writeCommitMessageOrOfferToStage = Effect.fn("ScmController.writeCommitMessageOrOfferToStage")(
  function* (_sourceControlArgument: unknown, repoPath: RepoPath) {
    yield* writeCommitMessageOrShowError(repoPath);
  },
  (effect, sourceControlArgument, repoPath) =>
    Effect.catchTag(effect, "NothingStaged", () => Effect.forkDetach(stageAllAndRetry(sourceControlArgument, repoPath)))
);

const showGeneratingProgress = Effect.fn("ScmController.showGeneratingProgress")(
  function* (sourceControlArgument: unknown, repoPath: RepoPath) {
    const {ProgressLocation} = yield* VsCodeService;

    yield* setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, true);
    yield* withProgress(
      {location: ProgressLocation.SourceControl, title: COMMIT_MESSAGES.GENERATING},
      writeCommitMessageOrOfferToStage(sourceControlArgument, repoPath)
    );
  },
  Effect.ensuring(setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, false))
);

export const generateCommitMessage = Effect.fn("ScmController.generateCommitMessage")(
  function* (sourceControlArgument: unknown) {
    yield* showGeneratingProgress(sourceControlArgument, yield* getSourceControlRepoPath(sourceControlArgument));
  },
  Effect.catchTag("RootUriUnavailable", () => showErrorInBackground(COMMIT_MESSAGES.ROOT_URI_UNAVAILABLE))
);
