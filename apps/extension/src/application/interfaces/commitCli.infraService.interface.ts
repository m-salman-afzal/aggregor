import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export interface CommitMessageRequest {
  readonly commitCommand: string;
  readonly projectPath: ProjectPathValueObject;
  readonly stagedDiff: string;
}

export class CommitCliError extends Schema.TaggedError<CommitCliError, {readonly brand: unique symbol}>()(
  "CommitCliError",
  {exitCode: Schema.Int, stderr: Schema.String}
) {}
export class CommitCliSpawnFailedError extends Schema.TaggedError<
  CommitCliSpawnFailedError,
  {readonly brand: unique symbol}
>()("CommitCliSpawnFailedError", {reason: Schema.String}) {}
export class EmptyCommitMessageError extends Schema.TaggedError<
  EmptyCommitMessageError,
  {readonly brand: unique symbol}
>()("EmptyCommitMessageError", {}) {}

// The user's commit command: it reads the staged diff on stdin and prints a commit message.
export class ICommitCliInfraService extends Context.Service<
  ICommitCliInfraService,
  {
    readonly generateCommitMessage: (
      commitMessageRequest: CommitMessageRequest
    ) => Effect.Effect<string, CommitCliError | CommitCliSpawnFailedError | EmptyCommitMessageError>;
  }
>()("aggregor-app/application/interfaces/commitCli.infraService.interface/ICommitCliInfraService") {}
