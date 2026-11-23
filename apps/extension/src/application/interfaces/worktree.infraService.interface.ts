import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
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
  readonly startPoint: string;
  readonly worktreeName: string;
  readonly worktreesFolderName: string;
  readonly worktreesFolderPath: string;
}

export interface WorktreeBranch {
  readonly branchName: string;
  readonly isUpstreamGone: boolean;
  readonly worktreePath: string;
}

export interface ProjectBranchNames {
  readonly localBranchNames: readonly string[];
  readonly remoteBranchNames: readonly string[];
}

export interface BranchMergeCheck {
  readonly baseBranchName: string;
  readonly branchName: string;
  readonly projectPath: ProjectPathValueObject;
}

export interface WorktreeDiffStats {
  readonly changedFileCount: number;
  readonly deletionCount: number;
  readonly insertionCount: number;
}

export interface CopyIncludedFilesRequest {
  readonly filePatterns: readonly string[];
  readonly projectPath: ProjectPathValueObject;
  readonly worktreePath: ProjectPathValueObject;
}

export class IWorktreeInfraServiceErrors extends TaggedErrors({
  BranchDeleteFailedError: {gitError: Schema.String},
  BranchRenameFailedError: {gitError: Schema.String},
  NotGitRepositoryError: {},
  WorktreeCreateFailedError: {gitError: Schema.String},
  WorktreeHasChangesError: {worktreePath: Schema.String},
  WorktreeRemoveFailedError: {gitError: Schema.String}
}) {}

export class IWorktreeInfraService extends Context.Service<
  IWorktreeInfraService,
  {
    readonly copyIncludedFiles: (copyIncludedFilesRequest: CopyIncludedFilesRequest) => Effect.Effect<void>;
    readonly createWorktree: (
      createWorktreeRequest: CreateWorktreeRequest
    ) => Effect.Effect<GitWorktree, IWorktreeInfraServiceErrors["WorktreeCreateFailedError"]>;
    readonly deleteBranch: (
      projectPath: ProjectPathValueObject,
      branchName: string
    ) => Effect.Effect<void, IWorktreeInfraServiceErrors["BranchDeleteFailedError"]>;
    // Network: brings origin's branches up to date; offline, nothing changes.
    readonly fetchRemote: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    readonly findFreeBranchName: (
      worktreePath: ProjectPathValueObject,
      branchName: string
    ) => Effect.Effect<string, IWorktreeInfraServiceErrors["BranchRenameFailedError"]>;
    readonly findWorktreesRootPath: (worktreesFolderPath: string) => Effect.Effect<string>;
    readonly hasChanges: (worktreePath: ProjectPathValueObject) => Effect.Effect<boolean>;
    readonly hasUpstream: (worktreePath: ProjectPathValueObject) => Effect.Effect<boolean>;
    readonly isBranchMerged: (branchMergeCheck: BranchMergeCheck) => Effect.Effect<boolean>;
    readonly isMadeByAggregor: (
      worktreePath: ProjectPathValueObject,
      worktreesFolderPath: string
    ) => Effect.Effect<boolean>;
    readonly listBranchNames: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<ProjectBranchNames, IWorktreeInfraServiceErrors["NotGitRepositoryError"]>;
    readonly listLocalBranches: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<readonly WorktreeBranch[], IWorktreeInfraServiceErrors["NotGitRepositoryError"]>;
    readonly listWorktrees: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<readonly GitWorktree[], IWorktreeInfraServiceErrors["NotGitRepositoryError"]>;
    // Network: refreshes which upstreams are gone; offline, nothing changes.
    readonly pruneRemote: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    readonly readBranchName: (
      worktreePath: ProjectPathValueObject
    ) => Effect.Effect<string, IWorktreeInfraServiceErrors["NotGitRepositoryError"]>;
    readonly readDiffStats: (
      worktreePath: ProjectPathValueObject,
      baseBranchName: string
    ) => Effect.Effect<WorktreeDiffStats, IWorktreeInfraServiceErrors["NotGitRepositoryError"]>;
    readonly removeWorktree: (
      projectPath: ProjectPathValueObject,
      worktreePath: ProjectPathValueObject
    ) => Effect.Effect<void, IWorktreeInfraServiceErrors["WorktreeHasChangesError" | "WorktreeRemoveFailedError"]>;
    readonly renameBranch: (
      worktreePath: ProjectPathValueObject,
      branchName: string
    ) => Effect.Effect<void, IWorktreeInfraServiceErrors["BranchRenameFailedError"]>;
  }
>()("aggregor-app/application/interfaces/worktree.infraService.interface/IWorktreeInfraService") {}
