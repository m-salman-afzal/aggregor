import {Context} from "effect";

import type {
  CommitCliError,
  CommitCliSpawnFailedError,
  EmptyCommitMessageError
} from "@/application/interfaces/commitCli/commitCli.infraService.error.ts";
import type {ProjectPathValueObject} from "@/domain/valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export interface CommitMessageRequest {
  readonly commitCommand: string;
  readonly projectPath: ProjectPathValueObject;
  readonly stagedDiff: string;
}

// The user's commit command: it reads the staged diff on stdin and prints a commit message.
export class ICommitCliInfraService extends Context.Service<
  ICommitCliInfraService,
  {
    readonly generateCommitMessage: (
      commitMessageRequest: CommitMessageRequest
    ) => Effect.Effect<string, CommitCliError | CommitCliSpawnFailedError | EmptyCommitMessageError>;
  }
>()("aggregor/application/interfaces/commitCli/commitCli.infraService.interface/ICommitCliInfraService") {}
