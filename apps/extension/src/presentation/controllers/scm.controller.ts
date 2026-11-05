import {offerToStageAllChanges, writeCommitMessageOrShowError} from "@/application/scm/scm.service.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {setContext, withProgress} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {RootUriUnavailable} from "@/presentation/errors/scm.error.ts";
import {COMMANDS, CONTEXT_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Result} from "effect";

import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
import type {SourceControl} from "vscode";

// The Source Control title button passes its SourceControl; the use cases name the repo by its root folder.
const getSourceControlRepoPath = Effect.fn("getSourceControlRepoPath")(function* (sourceControl: SourceControl) {
  const rootUri = yield* Effect.fromResult(Result.fromNullishOr(sourceControl.rootUri, () => new RootUriUnavailable()));

  return RepoPathSchema.make(rootUri.fsPath);
});

// After Stage All, the command runs again, so the retry shows its progress too.
const stageAllAndRetry = Effect.fn("stageAllAndRetry")(function* (sourceControl: SourceControl, repoPath: RepoPath) {
  if (!(yield* offerToStageAllChanges(repoPath))) return;

  const {commands} = yield* VsCodeService;
  yield* Effect.promise(async () => commands.executeCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, sourceControl));
});

// The offer waits on the user, so it runs detached and the progress ends now.
const writeCommitMessageOrOfferToStage = Effect.fn("writeCommitMessageOrOfferToStage")(
  function* (_sourceControl: SourceControl, repoPath: RepoPath) {
    yield* writeCommitMessageOrShowError(repoPath);
  },
  (effect, sourceControl, repoPath) =>
    Effect.catchTag(effect, "NothingStaged", () => Effect.forkDetach(stageAllAndRetry(sourceControl, repoPath)))
);

const showGeneratingProgress = Effect.fn("showGeneratingProgress")(
  function* (sourceControl: SourceControl, repoPath: RepoPath) {
    const {ProgressLocation} = yield* VsCodeService;

    yield* setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, true);
    yield* withProgress(
      {location: ProgressLocation.SourceControl, title: COMMIT_MESSAGES.GENERATING},
      writeCommitMessageOrOfferToStage(sourceControl, repoPath)
    );
  },
  Effect.ensuring(setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, false))
);

export const generateCommitMessage = Effect.fn("generateCommitMessage")(
  function* (sourceControl: SourceControl) {
    yield* showGeneratingProgress(sourceControl, yield* getSourceControlRepoPath(sourceControl));
  },
  Effect.catchTag("RootUriUnavailable", () => showErrorInBackground(COMMIT_MESSAGES.ROOT_URI_UNAVAILABLE))
);
