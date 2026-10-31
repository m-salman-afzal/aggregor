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
import {ErrorService} from "@/services/error.service.ts";
import {RepoStore} from "@/services/repo/repo.service.ts";
import {ScmService} from "@/services/scm/scm.service.ts";
import {SettingsService} from "@/services/settings.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {setContext, withProgress} from "@/services/vsc.utils.ts";
import {COMMANDS, CONTEXT_KEYS, EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {ACTIONS, COMMIT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {Effect, Layer, Match, Ref, Result, Stream, SubscriptionRef} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {API, GitExtension, Repository} from "@pkg/typings/src/git.js";
import type * as vsc from "vscode";

const getRootUri = Effect.fn("getRootUri")(function* () {
  const scm = yield* (yield* ScmService).scm;

  return yield* Effect.fromResult(Result.fromNullishOr(scm.rootUri, () => new RootUriUnavailable()));
});

const getGitExtension = Effect.fn("getGitExtension")(function* () {
  const {extensions} = yield* VscService;
  const gitExtension = yield* Effect.fromResult(
    Result.fromNullishOr(extensions.getExtension<GitExtension>("vscode.git"), () => new GitExtensionUnavailable())
  );

  return yield* Effect.try({
    catch: () => new GitExtensionDisabled(),
    try: () => gitExtension.exports.getAPI(EXTENSION_VERSIONS.git)
  });
});

const getRepository = Effect.fn("getRepository")(function* (api: API, uri: vsc.Uri) {
  return yield* Effect.fromResult(Result.fromNullishOr(api.getRepository(uri), () => new GitRepositoryUnavailable()));
});

const getGitRepository = Effect.fn("getGitRepository")(function* () {
  const [api, uri] = yield* Effect.all([getGitExtension(), getRootUri()]);

  return yield* getRepository(api, uri);
});

const getStagedRepository = Effect.fn("getStagedRepository")(function* () {
  return yield* Effect.filterOrFail(
    getGitRepository(),
    (repo) => repo.state.indexChanges.length > 0,
    () => new NothingStaged()
  );
});

export const getGitDiff = Effect.fn("getGitDiff")(function* (repository: Repository) {
  return yield* Effect.tryPromise({
    catch: () => new GitDiffError(),
    try: async () => repository.diff(true)
  });
});

export const getCommitMessage = Effect.fn("getCommitMessage")(function* (
  repository: Repository,
  commitCommand: string
) {
  const stagedDiff = yield* getGitDiff(repository);
  const spawner = yield* ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make(commitCommand, {
      cwd: repository.rootUri.fsPath,
      shell: true,
      stdin: Stream.make(stagedDiff).pipe(Stream.encodeText)
    })
  );

  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode
    ],
    {concurrency: "unbounded"}
  );
  if (exitCode !== EXIT_CODES.SUCCESSFUL) return yield* new CommitCliError({exitCode, stderr: stderr.trim()});

  const commitMessage = stdout.trim();
  if (commitMessage.length === 0) return yield* new EmptyCommitMessage();

  return commitMessage;
});

const commitStaged = Effect.fn("commitStaged")(function* (repository: Repository, commitMessage: string) {
  yield* Effect.tryPromise({
    catch: (cause) => new CommitFailed({cause}),
    try: async () => repository.commit(commitMessage)
  });
});

export const writeCommitMessage = Effect.fn("writeCommitMessage")(
  function* () {
    const {autoCommit, commitCommand} = yield* SettingsService.use((settingsService) => settingsService.read);
    const stagedRepository = yield* getStagedRepository();
    const commitMessage = yield* getCommitMessage(stagedRepository, commitCommand);

    const scm = yield* (yield* ScmService).scm;
    yield* Effect.sync(() => {
      scm.inputBox.value = commitMessage;
    });

    if (autoCommit) yield* commitStaged(stagedRepository, commitMessage);
  },
  (effect) => effect.pipe(Effect.scoped)
);

const offerStageAll = Effect.fn("offerStageAll")(function* () {
  const {commands} = yield* VscService;
  const scm = yield* (yield* ScmService).scm;
  const choice = yield* ErrorService.use((s) => s.show(COMMIT_MESSAGES.NOTHING_STAGED, ACTIONS.STAGE_ALL));
  if (choice !== ACTIONS.STAGE_ALL) return;

  yield* Effect.promise(async () => commands.executeCommand("git.stageAll", scm));
  yield* Effect.promise(async () => commands.executeCommand(COMMANDS.SCM_TITLE.GENERATE_COMMIT_MESSAGE, scm));
});

const toMessage = Effect.fn("toMessage")(function* () {
  return yield* writeCommitMessage().pipe(
    Effect.catchTag("NothingStaged", () => Effect.forkDetach(offerStageAll())),
    Effect.catch((error) =>
      Effect.forkDetach(
        ErrorService.use((s) =>
          s.show(
            Match.valueTags(error, {
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
      )
    )
  );
});

export const generateCommitMessage = Effect.fn("generateCommitMessage")(
  function* (scm: vsc.SourceControl) {
    const {ProgressLocation} = yield* VscService;

    yield* setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, true);
    yield* withProgress(
      {location: ProgressLocation.SourceControl, title: COMMIT_MESSAGES.GENERATING},
      toMessage().pipe(Effect.provideService(ScmService, {scm: Effect.sync(() => scm)}))
    );
  },
  (effect) => effect.pipe(Effect.ensuring(setContext(CONTEXT_KEYS.IS_GENERATING_COMMIT_MESSAGE, false)))
);

// A folder that is not a git repo, or git being off, leaves the repo in our sidebar only.
const openInGit = Effect.fn("openInGit")(function* (api: API, path: string) {
  const {Uri} = yield* VscService;

  yield* Effect.ignore(Effect.tryPromise(async () => api.openRepository(Uri.file(path))));
});

// The git API cannot close a repo, so this runs git.close, which closes whichever repo contains the path and asks the
// user to pick one when none does. It only runs for a repo whose root is exactly the path.
// ponytail: a path inside a repo, or reached through a symlink, stays in Source Control until the next reload.
const closeInGit = Effect.fn("closeInGit")(function* (api: API, path: string) {
  const {commands, Uri} = yield* VscService;
  const repository = api.getRepository(Uri.file(path));
  if (repository?.rootUri.fsPath !== path) return;

  yield* Effect.ignore(Effect.tryPromise(async () => commands.executeCommand("git.close", repository.rootUri)));
});

// Keeps Source Control in step with the added repos: each opens there, at startup too, and closes when removed. The git
// extension does not remember repos opened this way, so every startup opens them again.
export const GitReposLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const {added} = yield* RepoStore;
    const synced = yield* Ref.make<ReadonlySet<string>>(new Set());

    const syncGit = Effect.fn("syncGit")(function* (paths: readonly string[]) {
      const before = yield* Ref.getAndSet(synced, new Set(paths));
      const api = yield* getGitExtension();

      yield* Effect.forEach(
        paths.filter((path) => !before.has(path)),
        (path) => openInGit(api, path)
      );
      yield* Effect.forEach(
        [...before].filter((path) => !paths.includes(path)),
        (path) => closeInGit(api, path)
      );
    });

    yield* Effect.forkScoped(
      Stream.runForEach(SubscriptionRef.changes(added), (paths) => Effect.ignore(syncGit(paths)))
    );
  })
);
