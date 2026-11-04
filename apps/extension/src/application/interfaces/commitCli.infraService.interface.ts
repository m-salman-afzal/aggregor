import {Context} from "effect";

import type {
  CommitCliError,
  CommitCliSpawnFailedError,
  EmptyCommitMessageError
} from "@/application/interfaces/commitCli.infraService.error.ts";
import type {CommitMessageRequest} from "@/application/interfaces/commitCli.infraService.type.ts";
import type {Effect} from "effect";

// The user's commit command: it reads the staged diff on stdin and prints a commit message.
export class ICommitCliInfraService extends Context.Service<
  ICommitCliInfraService,
  {
    readonly generateCommitMessage: (
      commitMessageRequest: CommitMessageRequest
    ) => Effect.Effect<string, CommitCliError | CommitCliSpawnFailedError | EmptyCommitMessageError>;
  }
>()("aggregor/application/interfaces/commitCli.infraService.interface/ICommitCliInfraService") {}
