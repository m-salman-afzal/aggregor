import {NodeServices} from "@effect/platform-node";
import {ICommitCliInfraService, ICommitCliInfraServiceErrors} from "@interfaces/commitCli.infraService.interface.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer, Stream, String} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {CommitMessageRequest} from "@interfaces/commitCli.infraService.interface.ts";

export class CommitCliInfraService extends Context.Service<CommitCliInfraService>()(
  "aggregor-app/infrastructure/services/commitCli/commitCli.infraService/CommitCliInfraService",
  {
    make: Effect.fn("make")(function* () {
      const childProcessSpawner = yield* ChildProcessSpawner;

      const runCommitCommand = Effect.fn("runCommitCommand")(
        function* (commitMessageRequest: CommitMessageRequest) {
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
          Effect.fail(ICommitCliInfraServiceErrors.CommitCliSpawnFailedError.make({reason: platformError.message}))
        )
      );

      const generateCommitMessage = Effect.fn("generateCommitMessage")(function* (
        commitMessageRequest: CommitMessageRequest
      ) {
        const commitCommandOutput = yield* runCommitCommand(commitMessageRequest);
        if (commitCommandOutput.exitCode !== EXIT_CODES.SUCCESSFUL)
          return yield* ICommitCliInfraServiceErrors.CommitCliError.make({
            exitCode: commitCommandOutput.exitCode,
            stderr: String.trim(commitCommandOutput.stderr)
          });

        const commitMessage = String.trim(commitCommandOutput.stdout);
        if (commitMessage.length === 0) return yield* ICommitCliInfraServiceErrors.EmptyCommitMessageError.make();

        return commitMessage;
      });

      return {generateCommitMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(
    ICommitCliInfraService,
    ownSpans("CommitCliInfraService", this.make())
  ).pipe(Layer.provide(NodeServices.layer));
}
