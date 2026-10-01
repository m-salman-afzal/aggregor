import {
  CommitCliError,
  GitDiffError,
  GitExtensionDisabled,
  GitExtensionUnavailable,
  GitRepositoryUnavailable,
  NothingStaged,
  RootUriUnavailable
} from "@/errors/git.error.ts";
import {ErrorService} from "@/services/git/error.service.ts";
import {EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {SYSTEM_PROMPTS} from "@pkg/constants/src/prompt.constant.ts";
import {Effect, Match, pipe, Result, Stream} from "effect";
import {ChildProcess} from "effect/unstable/process";
import {ChildProcessSpawner} from "effect/unstable/process/ChildProcessSpawner";
import * as vsc from "vscode";

import type {GitExtension} from "@pkg/typings/src/git.js";

const getRootUri = (scm: vsc.SourceControl) => {
  return Result.fromNullishOr(scm.rootUri, () => new RootUriUnavailable());
};

const getGitExtension = () => {
  return pipe(
    Result.fromNullishOr(vsc.extensions.getExtension<GitExtension>("vscode.git"), () => new GitExtensionUnavailable()),
    Result.andThen((ext) =>
      Result.try({
        catch: () => new GitExtensionDisabled(),
        try: () => ext.exports.getAPI(EXTENSION_VERSIONS.git)
      })
    )
  );
};

const getGitRepository = (scm: vsc.SourceControl) => {
  return Effect.fromResult(
    pipe(
      Result.all({api: getGitExtension(), uri: getRootUri(scm)}),
      Result.andThen(({api, uri}) => Result.fromNullishOr(api.getRepository(uri), () => new GitRepositoryUnavailable()))
    )
  );
};

const getStagedRepository = (scm: vsc.SourceControl) => {
  return getGitRepository(scm).pipe(
    Effect.filterOrFail(
      (repo) => repo.state.indexChanges.length > 0,
      () => new NothingStaged()
    )
  );
};

export const getGitDiff = Effect.fn("getGitDiff")(function* (scm: vsc.SourceControl) {
  const hasStagedFiles = yield* getStagedRepository(scm);

  const gitDiff = yield* Effect.tryPromise({
    catch: () => new GitDiffError(),
    try: async () => hasStagedFiles.diff(true)
  });

  return gitDiff;
});

export const getCommitMessage = Effect.fn("getCommitMessage")(function* (scm: vsc.SourceControl) {
  const stagedDiff = yield* getGitDiff(scm);
  const spawner = yield* ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make(
      "claude",
      [
        "-p",
        "Write the commit message for this staged diff.",
        "--system-prompt",
        SYSTEM_PROMPTS.COMMIT,
        "--tools",
        "",
        "--no-session-persistence",
        "--model",
        "haiku"
      ],
      {stdin: Stream.make(stagedDiff).pipe(Stream.encodeText)}
    )
  );

  const stdout = yield* Stream.mkString(Stream.decodeText(handle.stdout));
  const exitCode = yield* handle.exitCode;
  if (exitCode !== EXIT_CODES.SUCCESSFUL) return yield* new CommitCliError();

  return stdout.trim();
});

export const writeCommitMessage = Effect.fn("writeCommitMessage")(
  function* (scm: vsc.SourceControl) {
    const commitMessage = yield* getCommitMessage(scm);

    return yield* Effect.sync(() => {
      scm.inputBox.value = commitMessage;
    });
  },
  (effect) => effect.pipe(Effect.scoped)
);

const STAGE_ALL_ACTION = "Stage All & Generate";

const offerStageAll = Effect.fn("offerStageAll")(function* (scm: vsc.SourceControl) {
  const choice = yield* ErrorService.use((s) => s.show("Nothing is staged.", STAGE_ALL_ACTION));
  if (choice !== STAGE_ALL_ACTION) return;

  yield* Effect.promise(async () => vsc.commands.executeCommand("git.stageAll", scm));
  yield* Effect.promise(async () => vsc.commands.executeCommand("aggregor.generateCommitMessage", scm));
});

// Toasts run detached so the progress spinner doesn't wait for the user to dismiss them.
export const toMessage = (scm: vsc.SourceControl) => {
  return writeCommitMessage(scm).pipe(
    Effect.catchTag("NothingStaged", () => Effect.forkDetach(offerStageAll(scm))),
    Effect.catch((error) =>
      Effect.forkDetach(
        ErrorService.use((s) =>
          s.show(
            Match.valueTags(error, {
              CommitCliError: () => "Claude CLI failed to generate a commit message.",
              GitDiffError: () => "Could not read the staged diff.",
              GitExtensionDisabled: () => "The built-in Git extension is disabled. Enable it and try again.",
              GitExtensionUnavailable: () => "The built-in Git extension was not found.",
              GitRepositoryUnavailable: () => "No Git repository found for this source control.",
              PlatformError: (platformError) => `Could not run the Claude CLI: ${platformError.message}`,
              RootUriUnavailable: () => "This source control has no root folder."
            })
          )
        )
      )
    )
  );
};
