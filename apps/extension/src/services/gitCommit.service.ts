/* eslint-disable max-classes-per-file */
import {EXTENSION_VERSIONS} from "@pkg/constants/src/extension.constant.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {SYSTEM_PROMPTS} from "@pkg/constants/src/prompt.constant.ts";
import {Data, Effect, pipe, Result, Stream} from "effect";
import {ChildProcess} from "effect/unstable/process";
import {ChildProcessSpawner} from "effect/unstable/process/ChildProcessSpawner";
import * as vsc from "vscode";

import type {GitExtension} from "@pkg/typings/src/git.js";

class CommitCliError extends Data.TaggedError("CommitCliError")<{exitCode: number}> {}
class GitDiffError extends Data.TaggedError("GitDiffError")<{reason: string}> {}
class GitExtensionDisabled extends Data.TaggedError("GitExtensionDisabled")<{reason: string}> {}
class GitExtensionUnavailable extends Data.TaggedError("GitExtensionUnavailable")<{reason: string}> {}
class GitRepositoryUnavailable extends Data.TaggedError("GitRepositoryUnavailable")<{reason: string}> {}
class RootUriUnavailable extends Data.TaggedError("RootUriUnavailable")<{reason: string}> {}

const getRootUri = (scm: vsc.SourceControl) => {
  return Result.fromNullishOr(scm.rootUri, () => new RootUriUnavailable({reason: "Root Uri Unavailable"}));
};

const getGitExtension = () => {
  return pipe(
    Result.fromNullishOr(
      vsc.extensions.getExtension<GitExtension>("vscode.git"),
      () => new GitExtensionUnavailable({reason: "Git Extension Not Aailable"})
    ),
    Result.andThen((ext) =>
      Result.try({
        catch: () => new GitExtensionDisabled({reason: "Git Extension Disabled"}),
        try: () => ext.exports.getAPI(EXTENSION_VERSIONS.git)
      })
    )
  );
};

const getGitRepository = (scm: vsc.SourceControl) => {
  return Effect.fromResult(
    pipe(
      Result.all({api: getGitExtension(), uri: getRootUri(scm)}),
      Result.andThen(({api, uri}) =>
        Result.fromNullishOr(
          api.getRepository(uri),
          () => new GitRepositoryUnavailable({reason: "Git Repository Unavailable"})
        )
      )
    )
  );
};

export const getGitDiff = Effect.fn("getGitDiff")(function* (scm: vsc.SourceControl) {
  const gitRepository = yield* getGitRepository(scm);
  const gitDiff = yield* Effect.tryPromise({
    catch: () => new GitDiffError({reason: "Git Diff Errored"}),
    try: async () => gitRepository.diff(true)
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
  if (exitCode !== EXIT_CODES.SUCCESSFUL) return yield* new CommitCliError({exitCode});

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
