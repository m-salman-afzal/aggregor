import {CommitCliClient} from "@/application/clients/commit-cli.client.ts";
import {GitClient} from "@/application/clients/git.client.ts";
import {PromptClient} from "@/application/clients/prompt.client.ts";
import {SettingsClient} from "@/application/clients/settings.client.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {ProjectRepository} from "@/domain/entities/project/project.repository.ts";
import {ACTIONS, COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Ref, Stream, SubscriptionRef} from "effect";

import type {ProjectPath} from "@/domain/value-objects/project-path.value-object.ts";

// The commit command writes the message for the staged changes into Source Control, and commits when autoCommit is on.
const writeCommitMessage = Effect.fn("writeCommitMessage")(function* (projectPath: ProjectPath) {
  const {autoCommit, commitCommand} = yield* SettingsClient.use((settingsClient) => settingsClient.readSettings());
  const gitClient = yield* GitClient;
  const stagedDiff = yield* gitClient.getStagedDiff(projectPath);
  const commitMessage = yield* CommitCliClient.use((commitCliClient) =>
    commitCliClient.generateCommitMessage({commitCommand, projectPath, stagedDiff})
  );

  yield* gitClient.setCommitMessageInput(projectPath, commitMessage);
  if (autoCommit) yield* gitClient.commit(projectPath, commitMessage);
});

// Every failure but NothingStaged becomes a message; the caller answers NothingStaged by offering to stage everything.
export const writeCommitMessageOrShowError = Effect.fn("writeCommitMessageOrShowError")(
  function* (projectPath: ProjectPath) {
    yield* writeCommitMessage(projectPath);
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
export const offerToStageAllChanges = Effect.fn("offerToStageAllChanges")(function* (projectPath: ProjectPath) {
  const pickedAction = yield* PromptClient.use((promptClient) =>
    promptClient.showErrorMessage(COMMIT_MESSAGES.NOTHING_STAGED, ACTIONS.STAGE_ALL)
  );
  if (pickedAction !== ACTIONS.STAGE_ALL) return false;

  yield* GitClient.use((gitClient) => gitClient.stageAll(projectPath));

  return true;
});

const syncAddedProjectsWithSourceControl = Effect.fn("syncAddedProjectsWithSourceControl")(function* (
  syncedProjectPaths: Ref.Ref<ReadonlySet<ProjectPath>>,
  currentAddedProjectPaths: readonly ProjectPath[]
) {
  const {closeInSourceControl, openInSourceControl} = yield* GitClient;
  const previouslySyncedProjectPaths = yield* Ref.getAndSet(syncedProjectPaths, new Set(currentAddedProjectPaths));

  yield* Effect.forEach(
    currentAddedProjectPaths.filter((projectPath) => !previouslySyncedProjectPaths.has(projectPath)),
    (projectPath) => openInSourceControl(projectPath)
  );
  yield* Effect.forEach(
    [...previouslySyncedProjectPaths].filter((projectPath) => !currentAddedProjectPaths.includes(projectPath)),
    (projectPath) => closeInSourceControl(projectPath)
  );
});

// Keeps Source Control in step with the added projects: each opens there, at startup too, and closes when removed. The git
// extension does not remember repositories opened this way, so every startup opens them again.
export const startSourceControlSync = Effect.fn("startSourceControlSync")(function* () {
  const {addedProjectPaths} = yield* ProjectRepository;
  const syncedProjectPaths = yield* Ref.make<ReadonlySet<ProjectPath>>(new Set());

  yield* Effect.forkScoped(
    Stream.runForEach(SubscriptionRef.changes(addedProjectPaths), (currentAddedProjectPaths) =>
      syncAddedProjectsWithSourceControl(syncedProjectPaths, currentAddedProjectPaths)
    )
  );
});
