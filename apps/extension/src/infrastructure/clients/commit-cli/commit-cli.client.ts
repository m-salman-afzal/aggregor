import {CommitCliClient} from "@/application/clients/commit-cli.client.ts";
import {CommitCliError, CommitCliSpawnFailed, EmptyCommitMessage} from "@/application/errors/commit-cli.error.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {Effect, Layer, Stream} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {CommitMessageRequest} from "@/application/clients/commit-cli.client.ts";

// Runs the command in a shell in the project, with the staged diff on stdin.
const runCommitCommand = Effect.fn("CommitCliClient.runCommitCommand")(
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
    Effect.fail(new CommitCliSpawnFailed({reason: platformError.message}))
  )
);

const generateCommitMessage = Effect.fn("CommitCliClient.generateCommitMessage")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  commitMessageRequest: CommitMessageRequest
) {
  const {exitCode, stderr, stdout} = yield* runCommitCommand(childProcessSpawner, commitMessageRequest);
  if (exitCode !== EXIT_CODES.SUCCESSFUL) return yield* new CommitCliError({exitCode, stderr: stderr.trim()});

  const commitMessage = stdout.trim();
  if (commitMessage.length === 0) return yield* new EmptyCommitMessage();

  return commitMessage;
});

const makeCommitCliClient = Effect.fn("CommitCliClient.make")(function* () {
  const childProcessSpawner = yield* ChildProcessSpawner;

  return {
    generateCommitMessage: (commitMessageRequest: CommitMessageRequest) =>
      generateCommitMessage(childProcessSpawner, commitMessageRequest)
  };
});

export const CommitCliClientOnChildProcess = Layer.effect(CommitCliClient, makeCommitCliClient());
