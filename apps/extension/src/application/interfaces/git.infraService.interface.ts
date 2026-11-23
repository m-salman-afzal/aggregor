import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export class IGitInfraServiceErrors extends TaggedErrors({
  CommitFailedError: {cause: Schema.Unknown},
  DetachedHeadPushError: {},
  GitDiffError: {},
  GitExtensionDisabledError: {},
  GitExtensionUnavailableError: {},
  GitRepositoryUnavailableError: {},
  NothingStagedError: {},
  PushFailedError: {cause: Schema.Unknown},
  PushRemoteAmbiguousError: {remoteNames: Schema.Array(Schema.String)}
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
    readonly push: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<
      void,
      | GitUnavailableError
      | IGitInfraServiceErrors["DetachedHeadPushError" | "PushFailedError" | "PushRemoteAmbiguousError"]
    >;
    readonly setCommitMessageInput: (
      projectPath: ProjectPathValueObject,
      commitMessage: string
    ) => Effect.Effect<void, GitUnavailableError>;
  }
>()("aggregor-app/application/interfaces/git.infraService.interface/IGitInfraService") {}
