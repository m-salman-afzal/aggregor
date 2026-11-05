import {Context, Data} from "effect";

import type {ProjectPathValueObject} from "@/domain/valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export interface CommitMessageRequest {
  readonly commitCommand: string;
  readonly projectPath: ProjectPathValueObject;
  readonly stagedDiff: string;
}

export class CommitCliError extends Data.TaggedError("CommitCliError")<{
  readonly exitCode: number;
  readonly stderr: string;
}> {}
// The command could not be started, or its output could not be read.
export class CommitCliSpawnFailedError extends Data.TaggedError("CommitCliSpawnFailedError")<{
  readonly reason: string;
}> {}
export class EmptyCommitMessageError extends Data.TaggedError("EmptyCommitMessageError") {}

// The user's commit command: it reads the staged diff on stdin and prints a commit message.
export class ICommitCliInfraService extends Context.Service<
  ICommitCliInfraService,
  {
    readonly generateCommitMessage: (
      commitMessageRequest: CommitMessageRequest
    ) => Effect.Effect<string, CommitCliError | CommitCliSpawnFailedError | EmptyCommitMessageError>;
  }
>()("aggregor/application/interfaces/commitCli.infraService.interface/ICommitCliInfraService") {}
