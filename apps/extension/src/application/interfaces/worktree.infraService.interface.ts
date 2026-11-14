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

export interface WorktreeBranch {
  readonly branchName: string;
  // The upstream it tracked is gone from the remote, as when its pull request merged and the remote branch was deleted.
  readonly isUpstreamGone: boolean;
  readonly worktreePath: string;
}

export interface BranchMergeCheck {
  readonly baseBranchName: string;
  readonly branchName: string;
  readonly projectPath: ProjectPathValueObject;
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

export class BranchRenameFailedError extends Schema.TaggedError<
  BranchRenameFailedError,
  {readonly brand: unique symbol}
>()("BranchRenameFailedError", {gitError: Schema.String}) {}

export class WorktreeHasChangesError extends Schema.TaggedError<
  WorktreeHasChangesError,
  {readonly brand: unique symbol}
>()("WorktreeHasChangesError", {worktreePath: Schema.String}) {}

export class WorktreeRemoveFailedError extends Schema.TaggedError<
  WorktreeRemoveFailedError,
  {readonly brand: unique symbol}
>()("WorktreeRemoveFailedError", {gitError: Schema.String}) {}

export class BranchDeleteFailedError extends Schema.TaggedError<
  BranchDeleteFailedError,
  {readonly brand: unique symbol}
>()("BranchDeleteFailedError", {gitError: Schema.String}) {}

export class IWorktreeInfraService extends Context.Service<
  IWorktreeInfraService,
  {
    readonly copyIncludedFiles: (copyIncludedFilesRequest: CopyIncludedFilesRequest) => Effect.Effect<void>;
    readonly createWorktree: (
      createWorktreeRequest: CreateWorktreeRequest
    ) => Effect.Effect<GitWorktree, WorktreeCreateFailedError>;
    readonly deleteBranch: (
      projectPath: ProjectPathValueObject,
      branchName: string
    ) => Effect.Effect<void, BranchDeleteFailedError>;
    // origin's default branch, or the project's own checked-out branch when there is no origin.
    readonly findBaseBranch: (projectPath: ProjectPathValueObject) => Effect.Effect<string, NotGitRepositoryError>;
    readonly findFreeBranchName: (
      worktreePath: ProjectPathValueObject,
      branchName: string
    ) => Effect.Effect<string, BranchRenameFailedError>;
    readonly findWorktreesRootPath: (worktreesFolderPath: string) => Effect.Effect<string>;
    readonly hasChanges: (worktreePath: ProjectPathValueObject) => Effect.Effect<boolean>;
    readonly hasUpstream: (worktreePath: ProjectPathValueObject) => Effect.Effect<boolean>;
    readonly isBranchMerged: (branchMergeCheck: BranchMergeCheck) => Effect.Effect<boolean>;
    // Under Aggregor's worktrees folder, or the project's own worktree folder setting.
    readonly isMadeByAggregor: (
      worktreePath: ProjectPathValueObject,
      worktreesFolderPath: string
    ) => Effect.Effect<boolean>;
    readonly listAggregorBranches: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<readonly WorktreeBranch[], NotGitRepositoryError>;
    readonly listWorktrees: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<readonly GitWorktree[], NotGitRepositoryError>;
    // Network: refreshes which upstreams are gone; offline, nothing changes.
    readonly pruneRemote: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    // A detached worktree gives its commit's short hash.
    readonly readBranchName: (worktreePath: ProjectPathValueObject) => Effect.Effect<string, NotGitRepositoryError>;
    // A folder already gone is only forgotten by git.
    readonly removeWorktree: (
      projectPath: ProjectPathValueObject,
      worktreePath: ProjectPathValueObject
    ) => Effect.Effect<void, WorktreeHasChangesError | WorktreeRemoveFailedError>;
    // Renames the branch the worktree has checked out.
    readonly renameBranch: (
      worktreePath: ProjectPathValueObject,
      branchName: string
    ) => Effect.Effect<void, BranchRenameFailedError>;
  }
>()("aggregor-app/application/interfaces/worktree.infraService.interface/IWorktreeInfraService") {}
