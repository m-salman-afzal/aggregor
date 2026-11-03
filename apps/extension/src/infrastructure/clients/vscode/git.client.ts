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

import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
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
  repoPath: RepoPath
) {
  return yield* Effect.fromResult(
    Result.fromNullishOr(gitApi.getRepository(gitDependencies.Uri.file(repoPath)), () => new GitRepositoryUnavailable())
  );
});

const getGitRepository = Effect.fn("GitClient.getGitRepository")(function* (
  gitDependencies: GitDependencies,
  repoPath: RepoPath
) {
  return yield* findGitRepository(gitDependencies, yield* getGitApi(gitDependencies), repoPath);
});

const getRepositoryWithStagedChanges = Effect.fn("GitClient.getRepositoryWithStagedChanges")(function* (
  gitDependencies: GitDependencies,
  repoPath: RepoPath
) {
  return yield* Effect.filterOrFail(
    getGitRepository(gitDependencies, repoPath),
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
  repoPath: RepoPath
) {
  return yield* readStagedDiff(yield* getRepositoryWithStagedChanges(gitDependencies, repoPath));
});

const setCommitMessageInput = Effect.fn("GitClient.setCommitMessageInput")(function* (
  gitDependencies: GitDependencies,
  repoPath: RepoPath,
  commitMessage: string
) {
  const repository = yield* getGitRepository(gitDependencies, repoPath);

  yield* Effect.sync(() => {
    repository.inputBox.value = commitMessage;
  });
});

const commit = Effect.fn("GitClient.commit")(function* (
  gitDependencies: GitDependencies,
  repoPath: RepoPath,
  commitMessage: string
) {
  const repository = yield* getGitRepository(gitDependencies, repoPath);

  yield* Effect.tryPromise({
    catch: (cause) => new CommitFailed({cause}),
    try: async () => repository.commit(commitMessage)
  });
});

// git.stageAll finds the repository that contains the path it is given.
const stageAll = Effect.fn("GitClient.stageAll")(function* (gitDependencies: GitDependencies, repoPath: RepoPath) {
  const {commands, Uri} = gitDependencies;

  yield* Effect.promise(async () => commands.executeCommand("git.stageAll", Uri.file(repoPath)));
});

// A folder that is not a git repo, or git being off, leaves the repo in our sidebar only.
const openInSourceControl = Effect.fn("GitClient.openInSourceControl")(
  function* (gitDependencies: GitDependencies, repoPath: RepoPath) {
    const gitApi = yield* getGitApi(gitDependencies);

    yield* Effect.tryPromise(async () => gitApi.openRepository(gitDependencies.Uri.file(repoPath)));
  },
  (effect, _gitDependencies, repoPath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not open ${repoPath} in Source Control`})
);

// The git API cannot close a repo, so this runs git.close, which closes whichever repo contains the path and asks the
// user to pick one when none does. It only runs for a repo whose root is exactly the path; a folder that is not a git
// repo has nothing to close.
// ponytail: a path inside a repo, or reached through a symlink, stays in Source Control until the next reload.
const closeInSourceControl = Effect.fn("GitClient.closeInSourceControl")(
  function* (gitDependencies: GitDependencies, repoPath: RepoPath) {
    const repository = yield* getGitRepository(gitDependencies, repoPath);
    if (repository.rootUri.fsPath !== repoPath) return;

    yield* Effect.tryPromise(async () => gitDependencies.commands.executeCommand("git.close", repository.rootUri));
  },
  Effect.catchTag("GitRepositoryUnavailable", () => Effect.void),
  (effect, _gitDependencies, repoPath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not close ${repoPath} in Source Control`})
);

const makeGitClientOnVsCode = Effect.fn("GitClient.make")(function* () {
  const gitDependencies: GitDependencies = yield* VsCodeService;

  return {
    closeInSourceControl: (repoPath: RepoPath) => closeInSourceControl(gitDependencies, repoPath),
    commit: (repoPath: RepoPath, commitMessage: string) => commit(gitDependencies, repoPath, commitMessage),
    getStagedDiff: (repoPath: RepoPath) => getStagedDiff(gitDependencies, repoPath),
    openInSourceControl: (repoPath: RepoPath) => openInSourceControl(gitDependencies, repoPath),
    setCommitMessageInput: (repoPath: RepoPath, commitMessage: string) =>
      setCommitMessageInput(gitDependencies, repoPath, commitMessage),
    stageAll: (repoPath: RepoPath) => stageAll(gitDependencies, repoPath)
  };
});

export const GitClientOnVsCode = Layer.effect(GitClient, makeGitClientOnVsCode());
