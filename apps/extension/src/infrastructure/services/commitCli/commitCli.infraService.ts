import {
  CommitCliError,
  CommitCliSpawnFailedError,
  EmptyCommitMessageError,
  ICommitCliInfraService
} from "@interfaces/commitCli.infraService.interface.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {Effect, Layer, Stream, String} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {CommitMessageRequest} from "@interfaces/commitCli.infraService.interface.ts";

const runCommitCommand = Effect.fn("CommitCliInfraService.runCommitCommand")(
  function* (childProcessSpawner: ChildProcessSpawner["Service"], commitMessageRequest: CommitMessageRequest) {
    const commitCommandProcess = yield* childProcessSpawner.spawn(
      ChildProcess.make(commitMessageRequest.commitCommand, {
        cwd: commitMessageRequest.projectPath,
        shell: true,
        stdin: Stream.make(commitMessageRequest.stagedDiff).pipe(Stream.encodeText)
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

    return {exitCode, stderr, stdout};
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (platformError) =>
    Effect.fail(CommitCliSpawnFailedError.make({reason: platformError.message}))
  )
);

const generateCommitMessage = Effect.fn("CommitCliInfraService.generateCommitMessage")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  commitMessageRequest: CommitMessageRequest
) {
  const commitCommandOutput = yield* runCommitCommand(childProcessSpawner, commitMessageRequest);
  if (commitCommandOutput.exitCode !== EXIT_CODES.SUCCESSFUL)
    return yield* CommitCliError.make({
      exitCode: commitCommandOutput.exitCode,
      stderr: String.trim(commitCommandOutput.stderr)
    });

  const commitMessage = String.trim(commitCommandOutput.stdout);
  if (commitMessage.length === 0) return yield* EmptyCommitMessageError.make();

  return commitMessage;
});

const makeCommitCliInfraService = Effect.fn("CommitCliInfraService.make")(function* () {
  const childProcessSpawner = yield* ChildProcessSpawner;

  return {
    generateCommitMessage: (commitMessageRequest: CommitMessageRequest) =>
      generateCommitMessage(childProcessSpawner, commitMessageRequest)
  };
});

export const CommitCliInfraService = Layer.effect(ICommitCliInfraService, makeCommitCliInfraService());
