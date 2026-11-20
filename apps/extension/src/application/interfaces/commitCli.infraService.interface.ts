import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export interface CommitMessageRequest {
  readonly commitCommand: string;
  readonly projectPath: ProjectPathValueObject;
  readonly stagedDiff: string;
}

export class ICommitCliInfraServiceErrors extends TaggedErrors({
  CommitCliError: {exitCode: Schema.Int, stderr: Schema.String},
  CommitCliSpawnFailedError: {reason: Schema.String},
  EmptyCommitMessageError: {}
}) {}

// The user's commit command: it reads the staged diff on stdin and prints a commit message.
export class ICommitCliInfraService extends Context.Service<
  ICommitCliInfraService,
  {
    readonly generateCommitMessage: (
      commitMessageRequest: CommitMessageRequest
    ) => Effect.Effect<
      string,
      ICommitCliInfraServiceErrors["CommitCliError" | "CommitCliSpawnFailedError" | "EmptyCommitMessageError"]
    >;
  }
>()("aggregor-app/application/interfaces/commitCli.infraService.interface/ICommitCliInfraService") {}
