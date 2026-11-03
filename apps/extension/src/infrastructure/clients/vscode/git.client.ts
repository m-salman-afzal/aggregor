import {GitClient} from "@/application/clients/git.client.ts";
import {
  CommitFailed,
  GitDiffError,
  GitExtensionDisabled,
  GitExtensionUnavailable,
  GitRepositoryUnavailable,
  NothingStaged
} from "@/application/errors/git.error.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer, Result} from "effect";

import type {ProjectPath} from "@/domain/value-objects/project-path.value-object.ts";
import type {API, GitExtension, Repository} from "@pkg/typings/src/git.js";

// What the git functions share: VS Code's commands, extensions and Uri.
type GitDependencies = Pick<VsCodeService["Service"], "commands" | "extensions" | "Uri">;

const getGitApi = Effect.fn("GitClient.getGitApi")(function* ({extensions}: GitDependencies) {
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

const findGitRepository = Effect.fn("GitClient.findGitRepository")(function* (
  gitDependencies: GitDependencies,
  gitApi: API,
  projectPath: ProjectPath
) {
  return yield* Effect.fromResult(
    Result.fromNullishOr(
      gitApi.getRepository(gitDependencies.Uri.file(projectPath)),
      () => new GitRepositoryUnavailable()
    )
  );
});

const getGitRepository = Effect.fn("GitClient.getGitRepository")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPath
) {
  return yield* findGitRepository(gitDependencies, yield* getGitApi(gitDependencies), projectPath);
});

const getRepositoryWithStagedChanges = Effect.fn("GitClient.getRepositoryWithStagedChanges")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPath
) {
  return yield* Effect.filterOrFail(
    getGitRepository(gitDependencies, projectPath),
    (repository) => repository.state.indexChanges.length > 0,
    () => new NothingStaged()
  );
});

const readStagedDiff = Effect.fn("GitClient.readStagedDiff")(function* (repository: Repository) {
  return yield* Effect.tryPromise({
    catch: () => new GitDiffError(),
    try: async () => repository.diff(true)
  });
});

const getStagedDiff = Effect.fn("GitClient.getStagedDiff")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPath
) {
  return yield* readStagedDiff(yield* getRepositoryWithStagedChanges(gitDependencies, projectPath));
});

const setCommitMessageInput = Effect.fn("GitClient.setCommitMessageInput")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPath,
  commitMessage: string
) {
  const repository = yield* getGitRepository(gitDependencies, projectPath);

  yield* Effect.sync(() => {
    repository.inputBox.value = commitMessage;
  });
});

const commit = Effect.fn("GitClient.commit")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPath,
  commitMessage: string
) {
  const repository = yield* getGitRepository(gitDependencies, projectPath);

  yield* Effect.tryPromise({
    catch: (cause) => new CommitFailed({cause}),
    try: async () => repository.commit(commitMessage)
  });
});

// git.stageAll finds the repository that contains the path it is given.
const stageAll = Effect.fn("GitClient.stageAll")(function* (
  gitDependencies: GitDependencies,
  projectPath: ProjectPath
) {
  const {commands, Uri} = gitDependencies;

  yield* Effect.promise(async () => commands.executeCommand("git.stageAll", Uri.file(projectPath)));
});

// A folder that is not a git repository, or git being off, leaves the project in our sidebar only.
const openInSourceControl = Effect.fn("GitClient.openInSourceControl")(
  function* (gitDependencies: GitDependencies, projectPath: ProjectPath) {
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
const closeInSourceControl = Effect.fn("GitClient.closeInSourceControl")(
  function* (gitDependencies: GitDependencies, projectPath: ProjectPath) {
    const repository = yield* getGitRepository(gitDependencies, projectPath);
    if (repository.rootUri.fsPath !== projectPath) return;

    yield* Effect.tryPromise(async () => gitDependencies.commands.executeCommand("git.close", repository.rootUri));
  },
  Effect.catchTag("GitRepositoryUnavailable", () => Effect.void),
  (effect, _gitDependencies, projectPath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not close ${projectPath} in Source Control`})
);

const makeGitClientOnVsCode = Effect.fn("GitClient.make")(function* () {
  const gitDependencies: GitDependencies = yield* VsCodeService;

  return {
    closeInSourceControl: (projectPath: ProjectPath) => closeInSourceControl(gitDependencies, projectPath),
    commit: (projectPath: ProjectPath, commitMessage: string) => commit(gitDependencies, projectPath, commitMessage),
    getStagedDiff: (projectPath: ProjectPath) => getStagedDiff(gitDependencies, projectPath),
    openInSourceControl: (projectPath: ProjectPath) => openInSourceControl(gitDependencies, projectPath),
    setCommitMessageInput: (projectPath: ProjectPath, commitMessage: string) =>
      setCommitMessageInput(gitDependencies, projectPath, commitMessage),
    stageAll: (projectPath: ProjectPath) => stageAll(gitDependencies, projectPath)
  };
});

export const GitClientOnVsCode = Layer.effect(GitClient, makeGitClientOnVsCode());
