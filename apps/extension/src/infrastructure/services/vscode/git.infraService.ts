import {
  CommitFailedError,
  GitDiffError,
  GitExtensionDisabledError,
  GitExtensionUnavailableError,
  GitRepositoryUnavailableError,
  NothingStagedError
} from "@/application/errors/git.infraService.error.ts";
import {IGitInfraService} from "@/application/interfaces/git.infraService.interface.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer, Result} from "effect";

import type {ProjectPathValueObject} from "@/domain/valueObjects/projectPath.valueObject.ts";
import type {API, GitExtension, Repository} from "@pkg/typings/src/git.js";

// What the git functions share: VS Code's commands, extensions and Uri.
type GitDependencies = Pick<VsCodeApi["Service"], "commands" | "extensions" | "Uri">;

const getGitApi = Effect.fn("GitInfraService.getGitApi")(function* ({extensions}: GitDependencies) {
  const gitExtension = yield* Effect.fromResult(
    Result.fromNullishOr(extensions.getExtension<GitExtension>("vscode.git"), () => new GitExtensionUnavailableError())
  );
  // We can activate before git does (an open Sessions view activates us at startup), and git has no exports until it
  // is active. activate() returns them, at once when git is already active.
  const gitExports = yield* Effect.tryPromise({
    catch: () => new GitExtensionUnavailableError(),
    try: async () => gitExtension.activate()
  });

  // getAPI throws when git is turned off in the settings.
  return yield* Effect.try({
    catch: () => new GitExtensionDisabledError(),
    try: () => gitExports.getAPI(EXTENSION_VERSIONS.git)
  });
});

const findGitRepository = Effect.fn("GitInfraService.findGitRepository")(function* (
  gitDependencies: GitDependencies,
  gitApi: API,
  projectPath: ProjectPathValueObject
) {
  return yield* Effect.fromResult(
    Result.fromNullishOr(
      gitApi.getRepository(gitDependencies.Uri.file(projectPath)),
      () => new GitRepositoryUnavailableError()
    )
  );
});

const getGitRepository = Effect.fn("GitInfraService.getGitRepository")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  return yield* findGitRepository(gitDependencies, yield* getGitApi(gitDependencies), projectPath);
});

const getRepositoryWithStagedChanges = Effect.fn("GitInfraService.getRepositoryWithStagedChanges")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  return yield* Effect.filterOrFail(
    getGitRepository(gitDependencies, projectPath),
    (repository) => repository.state.indexChanges.length > 0,
    () => new NothingStagedError()
  );
});

const readStagedDiff = Effect.fn("GitInfraService.readStagedDiff")(function* (repository: Repository) {
  return yield* Effect.tryPromise({
    catch: () => new GitDiffError(),
    try: async () => repository.diff(true)
  });
});

const getStagedDiff = Effect.fn("GitInfraService.getStagedDiff")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  return yield* readStagedDiff(yield* getRepositoryWithStagedChanges(gitDependencies, projectPath));
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
    catch: (cause) => new CommitFailedError({cause}),
    try: async () => repository.commit(commitMessage)
  });
});

// git.stageAll finds the repository that contains the path it is given.
const stageAll = Effect.fn("GitInfraService.stageAll")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPathValueObject
) {
  const {commands, Uri} = gitDependencies;

  yield* Effect.promise(async () => commands.executeCommand("git.stageAll", Uri.file(projectPath)));
});

// A folder that is not a git repository, or git being off, leaves the project in our sidebar only.
const openInSourceControl = Effect.fn("GitInfraService.openInSourceControl")(
  function* (gitDependencies: GitDependencies, projectPath: ProjectPathValueObject) {
    const gitApi = yield* getGitApi(gitDependencies);

    yield* Effect.tryPromise(async () => gitApi.openRepository(gitDependencies.Uri.file(projectPath)));
  },
  (effect, _gitDependencies, projectPath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not open ${projectPath} in Source Control`})
);

// The git API cannot close a repository, so this runs git.close, which closes whichever repository contains the path and
// asks the user to pick one when none does. It only runs for a repository whose root is exactly the path; a folder that is
// not a git repository has nothing to close.
// ponytail: a project inside a repository, or reached through a symlink, stays in Source Control until the next reload.
const closeInSourceControl = Effect.fn("GitInfraService.closeInSourceControl")(
  function* (gitDependencies: GitDependencies, projectPath: ProjectPathValueObject) {
    const repository = yield* getGitRepository(gitDependencies, projectPath);
    if (repository.rootUri.fsPath !== projectPath) return;

    yield* Effect.tryPromise(async () => gitDependencies.commands.executeCommand("git.close", repository.rootUri));
  },
  Effect.catchTag("GitRepositoryUnavailableError", () => Effect.void),
  (effect, _gitDependencies, projectPath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not close ${projectPath} in Source Control`})
);

const makeGitInfraService = Effect.fn("GitInfraService.make")(function* () {
  const gitDependencies: GitDependencies = yield* VsCodeApi;

  return {
    closeInSourceControl: (projectPath: ProjectPathValueObject) => closeInSourceControl(gitDependencies, projectPath),
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
