import {Context} from "effect";

import type {CommitCliError, CommitCliSpawnFailed, EmptyCommitMessage} from "@/application/errors/commit-cli.error.ts";
import type {ProjectPath} from "@/domain/value-objects/project-path.value-object.ts";
import type {Effect} from "effect";

export interface CommitMessageRequest {
  readonly commitCommand: string;
  readonly projectPath: ProjectPath;
  readonly stagedDiff: string;
}

// The user's commit command: it reads the staged diff on stdin and prints a commit message.
export class CommitCliClient extends Context.Service<
  CommitCliClient,
  {
    readonly generateCommitMessage: (
      commitMessageRequest: CommitMessageRequest
    ) => Effect.Effect<string, CommitCliError | CommitCliSpawnFailed | EmptyCommitMessage>;
  }
>()("aggregor/application/clients/commit-cli.client/CommitCliClient") {}
