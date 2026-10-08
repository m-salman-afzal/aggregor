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
import {ErrorService} from "@/services/git/error.service.ts";
import {ScmService} from "@/services/git/scm.service.ts";
import {SettingsService} from "@/services/settings.service.ts";
import {EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {Effect, Match, Result, Stream} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";
import * as vsc from "vscode";

import type {API, GitExtension, Repository} from "@pkg/typings/src/git.js";

const getRootUri = Effect.fn("getRootUri")(function* () {
  const scm = yield* (yield* ScmService).scm;

  return yield* Effect.fromResult(Result.fromNullishOr(scm.rootUri, () => new RootUriUnavailable()));
});

const getGitExtension = Effect.fn("getGitExtension")(function* () {
  const gitExtension = yield* Effect.fromResult(
    Result.fromNullishOr(vsc.extensions.getExtension<GitExtension>("vscode.git"), () => new GitExtensionUnavailable())
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

const STAGE_ALL_ACTION = "Stage All & Generate";

const offerStageAll = Effect.fn("offerStageAll")(function* () {
  const scm = yield* ScmService;
  const choice = yield* ErrorService.use((s) => s.show("Nothing is staged.", STAGE_ALL_ACTION));
  if (choice !== STAGE_ALL_ACTION) return;

  yield* Effect.promise(async () => vsc.commands.executeCommand("git.stageAll", scm));
  yield* Effect.promise(async () => vsc.commands.executeCommand("aggregor.generateCommitMessage", scm));
});

export const toMessage = Effect.fn("toMessage")(function* () {
  return yield* writeCommitMessage().pipe(
    Effect.catchTag("NothingStaged", () => Effect.forkDetach(offerStageAll())),
    Effect.catch((error) =>
      Effect.forkDetach(
        ErrorService.use((s) =>
          s.show(
            Match.valueTags(error, {
              CommitCliError: ({exitCode, stderr}) => `Commit command exited with code ${exitCode}. ${stderr}`,
              CommitFailed: () => "Commit failed. Check the Git output for details.",
              EmptyCommitMessage: () => "Commit command printed an empty message.",
              GitDiffError: () => "Could not read the staged diff.",
              GitExtensionDisabled: () => "The built-in Git extension is disabled. Enable it and try again.",
              GitExtensionUnavailable: () => "The built-in Git extension was not found.",
              GitRepositoryUnavailable: () => "No Git repository found for this source control.",
              InvalidSettings: ({reason}) => `Invalid settings: ${reason}`,
              PlatformError: (platformError) => `Could not run the Claude CLI: ${platformError.message}`,
              RootUriUnavailable: () => "This source control has no root folder."
            })
          )
        )
      )
    )
  );
});
