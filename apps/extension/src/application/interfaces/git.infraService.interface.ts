import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

// Why the git repository at a path cannot be reached.
export type GitUnavailableError =
  GitExtensionDisabledError | GitExtensionUnavailableError | GitRepositoryUnavailableError;

export class CommitFailedError extends Schema.TaggedError<CommitFailedError, {readonly brand: unique symbol}>()(
  "CommitFailedError",
  {cause: Schema.Unknown}
) {}
export class GitDiffError extends Schema.TaggedError<GitDiffError, {readonly brand: unique symbol}>()(
  "GitDiffError",
  {}
) {}
export class GitExtensionDisabledError extends Schema.TaggedError<
  GitExtensionDisabledError,
  {readonly brand: unique symbol}
>()("GitExtensionDisabledError", {}) {}
export class GitExtensionUnavailableError extends Schema.TaggedError<
  GitExtensionUnavailableError,
  {readonly brand: unique symbol}
>()("GitExtensionUnavailableError", {}) {}
export class GitRepositoryUnavailableError extends Schema.TaggedError<
  GitRepositoryUnavailableError,
  {readonly brand: unique symbol}
>()("GitRepositoryUnavailableError", {}) {}
export class NothingStagedError extends Schema.TaggedError<NothingStagedError, {readonly brand: unique symbol}>()(
  "NothingStagedError",
  {}
) {}

// The git repositories VS Code's Source Control shows, each named by its root folder.
export class IGitInfraService extends Context.Service<
  IGitInfraService,
  {
    // Best effort: a folder that is not a git repository, or git being off, only logs a warning.
    readonly closeInSourceControl: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    readonly commit: (
      projectPath: ProjectPathValueObject,
      commitMessage: string
    ) => Effect.Effect<void, CommitFailedError | GitUnavailableError>;
    readonly getStagedDiff: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<string, GitDiffError | GitUnavailableError | NothingStagedError>;
    // Best effort: a folder that is not a git repository, or git being off, only logs a warning.
    readonly openInSourceControl: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    // Fills Source Control's commit message box.
    readonly setCommitMessageInput: (
      projectPath: ProjectPathValueObject,
      commitMessage: string
    ) => Effect.Effect<void, GitUnavailableError>;
    readonly stageAll: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/git.infraService.interface/IGitInfraService") {}
