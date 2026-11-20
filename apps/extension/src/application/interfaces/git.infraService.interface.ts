import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export class IGitInfraServiceErrors extends TaggedErrors({
  CommitFailedError: {cause: Schema.Unknown},
  GitDiffError: {},
  GitExtensionDisabledError: {},
  GitExtensionUnavailableError: {},
  GitRepositoryUnavailableError: {},
  NothingStagedError: {}
}) {}

export type GitUnavailableError = IGitInfraServiceErrors[
  "GitExtensionDisabledError" | "GitExtensionUnavailableError" | "GitRepositoryUnavailableError"];

export class IGitInfraService extends Context.Service<
  IGitInfraService,
  {
    readonly commit: (
      projectPath: ProjectPathValueObject,
      commitMessage: string
    ) => Effect.Effect<void, GitUnavailableError | IGitInfraServiceErrors["CommitFailedError"]>;
    readonly getStagedDiff: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<string, GitUnavailableError | IGitInfraServiceErrors["GitDiffError" | "NothingStagedError"]>;
    // Best effort: a folder that is no git repository is skipped, and git being off only logs a warning.
    readonly openInSourceControl: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    readonly setCommitMessageInput: (
      projectPath: ProjectPathValueObject,
      commitMessage: string
    ) => Effect.Effect<void, GitUnavailableError>;
  }
>()("aggregor-app/application/interfaces/git.infraService.interface/IGitInfraService") {}
