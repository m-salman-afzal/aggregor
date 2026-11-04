import {Context} from "effect";

import type {
  CommitFailedError,
  GitDiffError,
  GitUnavailableError,
  NothingStagedError
} from "@/application/interfaces/git.infraService.error.ts";
import type {ProjectPathValueObject} from "@/domain/valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

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
>()("aggregor/application/interfaces/git.infraService.interface/IGitInfraService") {}
