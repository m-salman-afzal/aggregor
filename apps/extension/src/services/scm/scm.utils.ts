import {PromptClient} from "@/application/clients/prompt.client.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {RepoRepository} from "@/domain/entities/repo/repo.repository.ts";
import {
  CommitCliError,
  CommitFailed,
  EmptyCommitMessage,
  GitDiffError,
  GitExtensionDisabled,
  GitExtensionUnavailable,
  GitRepositoryUnavailable,
  NothingStaged,
  RootUriUnavailable
} from "@/errors/git.error.ts";
import {SettingsService} from "@/infrastructure/config/settings.service.ts";
import {setContext, withProgress} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {COMMANDS, CONTEXT_KEYS, EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {ACTIONS, COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {Effect, Layer, Match, Ref, Result, Stream, SubscriptionRef} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {API, GitExtension, Repository} from "@pkg/typings/src/git.js";
import type {SourceControl, Uri} from "vscode";

const getSourceControlRootUri = Effect.fn("getSourceControlRootUri")(function* (sourceControl: SourceControl) {
  return yield* Effect.fromResult(Result.fromNullishOr(sourceControl.rootUri, () => new RootUriUnavailable()));
});

const getGitApi = Effect.fn("getGitApi")(function* () {
  const {extensions} = yield* VsCodeService;
  const gitExtension = yield* Effect.fromResult(
    Result.fromNullishOr(extensions.getExtension<GitExtension>("vscode.git"), () => new GitExtensionUnavailable())
  );
  // We can activate before git does (an open Sessions view activates us at startup), and git has no exports until it
  // is active. activate() returns them, at once when git is already active.
  const gitExports = yield* Effect.tryPromise({
    catch: () => new GitExtensionUnavailable(),
    try: async () => gitExtension.activate()
  });

  // getAPI throws when git is turned off in the settings.
  return yield* Effect.try({
    catch: () => new GitExtensionDisabled(),
    try: () => gitExports.getAPI(EXTENSION_VERSIONS.git)
  });
});

const findGitRepository = Effect.fn("findGitRepository")(function* (gitApi: API, rootUri: Uri) {
  return yield* Effect.fromResult(
    Result.fromNullishOr(gitApi.getRepository(rootUri), () => new GitRepositoryUnavailable())
  );
});

const getSourceControlRepository = Effect.fn("getSourceControlRepository")(function* (sourceControl: SourceControl) {
  const [gitApi, rootUri] = yield* Effect.all([getGitApi(), getSourceControlRootUri(sourceControl)]);

  return yield* findGitRepository(gitApi, rootUri);
});

const getRepositoryWithStagedChanges = Effect.fn("getRepositoryWithStagedChanges")(function* (
  sourceControl: SourceControl
) {
  return yield* Effect.filterOrFail(
    getSourceControlRepository(sourceControl),
    (repository) => repository.state.indexChanges.length > 0,
    () => new NothingStaged()
  );
});

const getStagedDiff = Effect.fn("getStagedDiff")(function* (repository: Repository) {
  return yield* Effect.tryPromise({
    catch: () => new GitDiffError(),
    try: async () => repository.diff(true)
  });
});

const getCommitMessage = Effect.fn("getCommitMessage")(function* (repository: Repository, commitCommand: string) {
  const stagedDiff = yield* getStagedDiff(repository);
  const childProcessSpawner = yield* ChildProcessSpawner;
  const commitCommandProcess = yield* childProcessSpawner.spawn(
    ChildProcess.make(commitCommand, {
      cwd: repository.rootUri.fsPath,
      shell: true,
      stdin: Stream.make(stagedDiff).pipe(Stream.encodeText)
    })
  );

  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(commitCommandProcess.stdout)),
      Stream.mkString(Stream.decodeText(commitCommandProcess.stderr)),
      commitCommandProcess.exitCode
    ],
    {concurrency: "unbounded"}
  );
  if (exitCode !== EXIT_CODES.SUCCESSFUL) return yield* new CommitCliError({exitCode, stderr: stderr.trim()});

  const commitMessage = stdout.trim();
  if (commitMessage.length === 0) return yield* new EmptyCommitMessage();

  return commitMessage;
});

const commitStagedChanges = Effect.fn("commitStagedChanges")(function* (repository: Repository, commitMessage: string) {
  yield* Effect.tryPromise({
    catch: (cause) => new CommitFailed({cause}),
    try: async () => repository.commit(commitMessage)
  });
});

const writeCommitMessage = Effect.fn("writeCommitMessage")(function* (sourceControl: SourceControl) {
  const {autoCommit, commitCommand} = yield* SettingsService.use((settingsService) => settingsService.readSettings());
  const stagedRepository = yield* getRepositoryWithStagedChanges(sourceControl);
  const commitMessage = yield* getCommitMessage(stagedRepository, commitCommand);

  yield* Effect.sync(() => {
    sourceControl.inputBox.value = commitMessage;
  });

  if (autoCommit) yield* commitStagedChanges(stagedRepository, commitMessage);
}, Effect.scoped);

const offerToStageAllChanges = Effect.fn("offerToStageAllChanges")(function* (sourceControl: SourceControl) {
  const {commands} = yield* VsCodeService;
  const pickedAction = yield* PromptClient.use((promptClient) =>
    promptClient.showErrorMessage(COMMIT_MESSAGES.NOTHING_STAGED, ACTIONS.STAGE_ALL)
  );
  if (pickedAction !== ACTIONS.STAGE_ALL) return;

  yield* Effect.promise(async () => commands.executeCommand("git.stageAll", sourceControl));
  yield* Effect.promise(async () => commands.executeCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, sourceControl));
});

const writeCommitMessageOrShowError = Effect.fn("writeCommitMessageOrShowError")(
  function* (sourceControl: SourceControl) {
    yield* writeCommitMessage(sourceControl);
  },
  (effect, sourceControl) =>
    Effect.catchTag(effect, "NothingStaged", () => Effect.forkDetach(offerToStageAllChanges(sourceControl))),
  Effect.catch((commitMessageError) =>
    showErrorInBackground(
      Match.valueTags(commitMessageError, {
        CommitCliError: ({exitCode, stderr}) => COMMIT_MESSAGES.COMMIT_CLI_FAILED(exitCode, stderr),
        CommitFailed: () => COMMIT_MESSAGES.COMMIT_FAILED,
        EmptyCommitMessage: () => COMMIT_MESSAGES.EMPTY_COMMIT_MESSAGE,
        GitDiffError: () => COMMIT_MESSAGES.GIT_DIFF_FAILED,
        GitExtensionDisabled: () => COMMIT_MESSAGES.GIT_EXTENSION_DISABLED,
        GitExtensionUnavailable: () => COMMIT_MESSAGES.GIT_EXTENSION_UNAVAILABLE,
        GitRepositoryUnavailable: () => COMMIT_MESSAGES.GIT_REPOSITORY_UNAVAILABLE,
        InvalidSettings: ({reason}) => COMMIT_MESSAGES.INVALID_SETTINGS(reason),
        PlatformError: (platformError) => COMMIT_MESSAGES.CLAUDE_CLI_FAILED(platformError.message),
        RootUriUnavailable: () => COMMIT_MESSAGES.ROOT_URI_UNAVAILABLE
      })
    )
  )
);

export const generateCommitMessage = Effect.fn("generateCommitMessage")(
  function* (sourceControl: SourceControl) {
    const {ProgressLocation} = yield* VsCodeService;

    yield* setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, true);
    yield* withProgress(
      {location: ProgressLocation.SourceControl, title: COMMIT_MESSAGES.GENERATING},
      writeCommitMessageOrShowError(sourceControl)
    );
  },
  Effect.ensuring(setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, false))
);

// A folder that is not a git repo, or git being off, leaves the repo in our sidebar only.
const openRepoInSourceControl = Effect.fn("openRepoInSourceControl")(
  function* (gitApi: API, repoPath: string) {
    const {Uri} = yield* VsCodeService;

    yield* Effect.tryPromise(async () => gitApi.openRepository(Uri.file(repoPath)));
  },
  (effect, _gitApi, repoPath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not open ${repoPath} in Source Control`})
);

// The git API cannot close a repo, so this runs git.close, which closes whichever repo contains the path and asks the
// user to pick one when none does. It only runs for a repo whose root is exactly the path; a folder that is not a git
// repo has nothing to close.
// ponytail: a path inside a repo, or reached through a symlink, stays in Source Control until the next reload.
const closeRepoInSourceControl = Effect.fn("closeRepoInSourceControl")(
  function* (gitApi: API, repoPath: string) {
    const {commands, Uri} = yield* VsCodeService;
    const repository = yield* findGitRepository(gitApi, Uri.file(repoPath));
    if (repository.rootUri.fsPath !== repoPath) return;

    yield* Effect.tryPromise(async () => commands.executeCommand("git.close", repository.rootUri));
  },
  Effect.catchTag("GitRepositoryUnavailable", () => Effect.void),
  (effect, _gitApi, repoPath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not close ${repoPath} in Source Control`})
);

// Keeps Source Control in step with the added repos: each opens there, at startup too, and closes when removed. The git
// extension does not remember repos opened this way, so every startup opens them again.
const startSourceControlSync = Effect.fn("startSourceControlSync")(function* () {
  const {addedRepoPaths} = yield* RepoRepository;
  const syncedRepoPaths = yield* Ref.make<ReadonlySet<string>>(new Set());

  const syncAddedReposWithSourceControl = Effect.fn("GitReposLayer.syncAddedReposWithSourceControl")(
    function* (currentAddedRepoPaths: readonly string[]) {
      const previouslySyncedRepoPaths = yield* Ref.getAndSet(syncedRepoPaths, new Set(currentAddedRepoPaths));
      const gitApi = yield* getGitApi();

      yield* Effect.forEach(
        currentAddedRepoPaths.filter((repoPath) => !previouslySyncedRepoPaths.has(repoPath)),
        (repoPath) => openRepoInSourceControl(gitApi, repoPath)
      );
      yield* Effect.forEach(
        [...previouslySyncedRepoPaths].filter((repoPath) => !currentAddedRepoPaths.includes(repoPath)),
        (repoPath) => closeRepoInSourceControl(gitApi, repoPath)
      );
    },
    Effect.ignore({log: "Warn", message: "Could not sync added repos with Source Control"})
  );

  yield* Effect.forkScoped(Stream.runForEach(SubscriptionRef.changes(addedRepoPaths), syncAddedReposWithSourceControl));
});

export const GitReposLayer = Layer.effectDiscard(startSourceControlSync());
