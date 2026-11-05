import {
  CommitFailedError,
  GitDiffError,
  GitExtensionDisabledError,
  GitExtensionUnavailableError,
  GitRepositoryUnavailableError,
  IGitInfraService,
  NothingStagedError
} from "@interfaces/git.infraService.interface.ts";
import {EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Layer, Result, Schema} from "effect";

import type {API, GitExtension, Repository} from "@pkg/typings/src/git.js";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// What the git functions share: VS Code's commands, extensions and Uri.
type GitDependencies = Pick<VsCodeApi["Service"], "commands" | "extensions" | "Uri">;

class GitRepositoryOpenFailedError extends Schema.TaggedError<
  GitRepositoryOpenFailedError,
  {readonly brand: unique symbol}
>()("GitRepositoryOpenFailedError", {cause: Schema.Unknown}) {}

const getGitApi = Effect.fn("GitInfraService.getGitApi")(function* ({extensions}: GitDependencies) {
  const gitExtension = yield* Effect.fromResult(
    Result.fromNullishOr(extensions.getExtension<GitExtension>("vscode.git"), () => GitExtensionUnavailableError.make())
  );
  // We can activate before git does (an open Sessions view activates us at startup), and git has no exports until it
  // is active. activate() returns them, at once when git is already active.
  const gitExports = yield* Effect.tryPromise({
    catch: () => GitExtensionUnavailableError.make(),
    try: () => gitExtension.activate()
  });

  // getAPI throws when git is turned off in the settings.
  return yield* Effect.try({
    catch: () => GitExtensionDisabledError.make(),
    try: () => gitExports.getAPI(EXTENSION_VERSIONS.git)
  });
});

const findGitRepository = Effect.fn("GitInfraService.findGitRepository")(function* (
  gitDependencies: GitDependencies,
  gitApi: API,
  projectPath: ProjectPathValueObject
) {
  return yield* Effect.fromResult(
    Result.fromNullishOr(gitApi.getRepository(gitDependencies.Uri.file(projectPath)), () =>
      GitRepositoryUnavailableError.make()
    )
  );
});

const getGitRepository = Effect.fn("GitInfraService.getGitRepository")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  const gitApi = yield* getGitApi(gitDependencies);

  return yield* findGitRepository(gitDependencies, gitApi, projectPath);
});

const getRepositoryWithStagedChanges = Effect.fn("GitInfraService.getRepositoryWithStagedChanges")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  return yield* Effect.filterOrFail(
    getGitRepository(gitDependencies, projectPath),
    (repository) => repository.state.indexChanges.length > 0,
    () => NothingStagedError.make()
  );
});

const readStagedDiff = Effect.fn("GitInfraService.readStagedDiff")(function* (repository: Repository) {
  return yield* Effect.tryPromise({
    catch: () => GitDiffError.make(),
    try: () => repository.diff(true)
  });
});

const getStagedDiff = Effect.fn("GitInfraService.getStagedDiff")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  const repository = yield* getRepositoryWithStagedChanges(gitDependencies, projectPath);

  return yield* readStagedDiff(repository);
});

const setCommitMessageInput = Effect.fn("GitInfraService.setCommitMessageInput")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject,
  commitMessage: string
) {
  const repository = yield* getGitRepository(gitDependencies, projectPath);

  yield* Effect.sync(() => {
    repository.inputBox.value = commitMessage;
  });
});

const commit = Effect.fn("GitInfraService.commit")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject,
  commitMessage: string
) {
  const repository = yield* getGitRepository(gitDependencies, projectPath);

  yield* Effect.tryPromise({
    catch: (cause) => CommitFailedError.make({cause}),
    try: () => repository.commit(commitMessage)
  });
});

// git.stageAll finds the repository that contains the path it is given.
const stageAll = Effect.fn("GitInfraService.stageAll")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  const {commands, Uri} = gitDependencies;

  yield* Effect.promise(() => commands.executeCommand("git.stageAll", Uri.file(projectPath)));
});

const openAndLoadRepository = Effect.fn("GitInfraService.openAndLoadRepository")(function* (
  gitDependencies: GitDependencies,
  gitApi: API,
  projectPath: ProjectPathValueObject
) {
  const repository = yield* Effect.tryPromise({
    catch: (cause) => GitRepositoryOpenFailedError.make({cause}),
    try: () => gitApi.openRepository(gitDependencies.Uri.file(projectPath))
  });
  // A folder that is not a git repository opens nothing.
  if (repository === null) return;

  yield* Effect.tryPromise({
    catch: (cause) => GitRepositoryOpenFailedError.make({cause}),
    try: () => repository.status()
  });
});

// Opens the project's repository and waits for its first status, so Source Control can show its changes at once. One
// already open, or inside an open one, is left alone.
const openInSourceControl = Effect.fn("GitInfraService.openInSourceControl")(
  function* (gitDependencies: GitDependencies, projectPath: ProjectPathValueObject) {
    const gitApi = yield* getGitApi(gitDependencies);
    if (gitApi.getRepository(gitDependencies.Uri.file(projectPath)) !== null) return;

    yield* openAndLoadRepository(gitDependencies, gitApi, projectPath);
  },
  Effect.ignore({log: "Warn", message: "Could not open the project in Source Control"})
);

const makeGitInfraService = Effect.fn("GitInfraService.make")(function* () {
  const gitDependencies: GitDependencies = yield* VsCodeApi;

  return {
    commit: (projectPath: ProjectPathValueObject, commitMessage: string) =>
      commit(gitDependencies, projectPath, commitMessage),
    getStagedDiff: (projectPath: ProjectPathValueObject) => getStagedDiff(gitDependencies, projectPath),
    openInSourceControl: (projectPath: ProjectPathValueObject) => openInSourceControl(gitDependencies, projectPath),
    setCommitMessageInput: (projectPath: ProjectPathValueObject, commitMessage: string) =>
      setCommitMessageInput(gitDependencies, projectPath, commitMessage),
    stageAll: (projectPath: ProjectPathValueObject) => stageAll(gitDependencies, projectPath)
  };
});

export const GitInfraService = Layer.effect(IGitInfraService, makeGitInfraService());
