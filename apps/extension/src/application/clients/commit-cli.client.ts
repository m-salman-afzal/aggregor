import {Context} from "effect";

import type {CommitCliError, CommitCliSpawnFailed, EmptyCommitMessage} from "@/application/errors/commit-cli.error.ts";
import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
import type {Effect} from "effect";

export interface CommitMessageRequest {
  readonly commitCommand: string;
  readonly repoPath: RepoPath;
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
