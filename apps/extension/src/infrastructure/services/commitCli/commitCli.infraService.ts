import {
  CommitCliError,
  CommitCliSpawnFailedError,
  EmptyCommitMessageError
} from "@/application/interfaces/commitCli/commitCli.infraService.error.ts";
import {ICommitCliInfraService} from "@/application/interfaces/commitCli/commitCli.infraService.interface.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {Effect, Layer, Stream} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {CommitMessageRequest} from "@/application/interfaces/commitCli/commitCli.infraService.interface.ts";

// Runs the command in a shell in the project, with the staged diff on stdin.
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
    Effect.fail(new CommitCliSpawnFailedError({reason: platformError.message}))
  )
);

const generateCommitMessage = Effect.fn("CommitCliInfraService.generateCommitMessage")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  commitMessageRequest: CommitMessageRequest
) {
  const {exitCode, stderr, stdout} = yield* runCommitCommand(childProcessSpawner, commitMessageRequest);
  if (exitCode !== EXIT_CODES.SUCCESSFUL) return yield* new CommitCliError({exitCode, stderr: stderr.trim()});

  const commitMessage = stdout.trim();
  if (commitMessage.length === 0) return yield* new EmptyCommitMessageError();

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
