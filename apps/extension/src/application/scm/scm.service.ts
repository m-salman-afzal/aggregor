import {CommitCliClient} from "@/application/clients/commit-cli.client.ts";
import {GitClient} from "@/application/clients/git.client.ts";
import {PromptClient} from "@/application/clients/prompt.client.ts";
import {SettingsClient} from "@/application/clients/settings.client.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {RepoRepository} from "@/domain/entities/repo/repo.repository.ts";
import {ACTIONS, COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Ref, Stream, SubscriptionRef} from "effect";

import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";

// The commit command writes the message for the staged changes into Source Control, and commits when autoCommit is on.
const writeCommitMessage = Effect.fn("writeCommitMessage")(function* (repoPath: RepoPath) {
  const {autoCommit, commitCommand} = yield* SettingsClient.use((settingsClient) => settingsClient.readSettings());
  const gitClient = yield* GitClient;
  const stagedDiff = yield* gitClient.getStagedDiff(repoPath);
  const commitMessage = yield* CommitCliClient.use((commitCliClient) =>
    commitCliClient.generateCommitMessage({commitCommand, repoPath, stagedDiff})
  );

  yield* gitClient.setCommitMessageInput(repoPath, commitMessage);
  if (autoCommit) yield* gitClient.commit(repoPath, commitMessage);
});

// Every failure but NothingStaged becomes a message; the caller answers NothingStaged by offering to stage everything.
export const writeCommitMessageOrShowError = Effect.fn("writeCommitMessageOrShowError")(
  function* (repoPath: RepoPath) {
    yield* writeCommitMessage(repoPath);
  },
  Effect.catchTags({
    CommitCliError: ({exitCode, stderr}) => showErrorInBackground(COMMIT_MESSAGES.COMMIT_CLI_FAILED(exitCode, stderr)),
    CommitCliSpawnFailed: ({reason}) => showErrorInBackground(COMMIT_MESSAGES.CLAUDE_CLI_FAILED(reason)),
    CommitFailed: () => showErrorInBackground(COMMIT_MESSAGES.COMMIT_FAILED),
    EmptyCommitMessage: () => showErrorInBackground(COMMIT_MESSAGES.EMPTY_COMMIT_MESSAGE),
    GitDiffError: () => showErrorInBackground(COMMIT_MESSAGES.GIT_DIFF_FAILED),
    GitExtensionDisabled: () => showErrorInBackground(COMMIT_MESSAGES.GIT_EXTENSION_DISABLED),
    GitExtensionUnavailable: () => showErrorInBackground(COMMIT_MESSAGES.GIT_EXTENSION_UNAVAILABLE),
    GitRepositoryUnavailable: () => showErrorInBackground(COMMIT_MESSAGES.GIT_REPOSITORY_UNAVAILABLE),
    InvalidSettings: ({reason}) => showErrorInBackground(COMMIT_MESSAGES.INVALID_SETTINGS(reason))
  })
);

// True when the user picked Stage All and everything is now staged.
export const offerToStageAllChanges = Effect.fn("offerToStageAllChanges")(function* (repoPath: RepoPath) {
  const pickedAction = yield* PromptClient.use((promptClient) =>
    promptClient.showErrorMessage(COMMIT_MESSAGES.NOTHING_STAGED, ACTIONS.STAGE_ALL)
  );
  if (pickedAction !== ACTIONS.STAGE_ALL) return false;

  yield* GitClient.use((gitClient) => gitClient.stageAll(repoPath));

  return true;
});

const syncAddedReposWithSourceControl = Effect.fn("syncAddedReposWithSourceControl")(function* (
  syncedRepoPaths: Ref.Ref<ReadonlySet<RepoPath>>,
  currentAddedRepoPaths: readonly RepoPath[]
) {
  const {closeInSourceControl, openInSourceControl} = yield* GitClient;
  const previouslySyncedRepoPaths = yield* Ref.getAndSet(syncedRepoPaths, new Set(currentAddedRepoPaths));

  yield* Effect.forEach(
    currentAddedRepoPaths.filter((repoPath) => !previouslySyncedRepoPaths.has(repoPath)),
    (repoPath) => openInSourceControl(repoPath)
  );
  yield* Effect.forEach(
    [...previouslySyncedRepoPaths].filter((repoPath) => !currentAddedRepoPaths.includes(repoPath)),
    (repoPath) => closeInSourceControl(repoPath)
  );
});

// Keeps Source Control in step with the added repos: each opens there, at startup too, and closes when removed. The git
// extension does not remember repos opened this way, so every startup opens them again.
export const startSourceControlSync = Effect.fn("startSourceControlSync")(function* () {
  const {addedRepoPaths} = yield* RepoRepository;
  const syncedRepoPaths = yield* Ref.make<ReadonlySet<RepoPath>>(new Set());

  yield* Effect.forkScoped(
    Stream.runForEach(SubscriptionRef.changes(addedRepoPaths), (currentAddedRepoPaths) =>
      syncAddedReposWithSourceControl(syncedRepoPaths, currentAddedRepoPaths)
    )
  );
});
