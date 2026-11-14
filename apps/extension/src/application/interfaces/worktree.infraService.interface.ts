import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export interface GitWorktree {
  readonly branchName: string;
  readonly worktreePath: ProjectPathValueObject;
}

export interface CreateWorktreeRequest {
  readonly branchName: string;
  readonly projectPath: ProjectPathValueObject;
  readonly worktreeName: string;
  readonly worktreesFolderName: string;
  readonly worktreesFolderPath: string;
}

export interface CopyIncludedFilesRequest {
  readonly filePatterns: readonly string[];
  readonly projectPath: ProjectPathValueObject;
  readonly worktreePath: ProjectPathValueObject;
}

export class NotGitRepositoryError extends Schema.TaggedError<NotGitRepositoryError, {readonly brand: unique symbol}>()(
  "NotGitRepositoryError",
  {}
) {}

export class WorktreeCreateFailedError extends Schema.TaggedError<
  WorktreeCreateFailedError,
  {readonly brand: unique symbol}
>()("WorktreeCreateFailedError", {gitError: Schema.String}) {}

export class IWorktreeInfraService extends Context.Service<
  IWorktreeInfraService,
  {
    readonly copyIncludedFiles: (copyIncludedFilesRequest: CopyIncludedFilesRequest) => Effect.Effect<void>;
    readonly createWorktree: (
      createWorktreeRequest: CreateWorktreeRequest
    ) => Effect.Effect<GitWorktree, WorktreeCreateFailedError>;
    readonly listWorktrees: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<readonly GitWorktree[], NotGitRepositoryError>;
  }
>()("aggregor-app/application/interfaces/worktree.infraService.interface/IWorktreeInfraService") {}
