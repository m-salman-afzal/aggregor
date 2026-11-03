import {Context} from "effect";

import type {
  CommitFailed,
  GitDiffError,
  GitExtensionDisabled,
  GitExtensionUnavailable,
  GitRepositoryUnavailable,
  NothingStaged
} from "@/application/errors/git.error.ts";
import type {ProjectPath} from "@/domain/value-objects/project-path.value-object.ts";
import type {Effect} from "effect";

// Why the git repository at a path cannot be reached.
export type GitUnavailable = GitExtensionDisabled | GitExtensionUnavailable | GitRepositoryUnavailable;

// The git repositories VS Code's Source Control shows, each named by its root folder.
export class GitClient extends Context.Service<
  GitClient,
  {
    // Best effort: a folder that is not a git repository, or git being off, only logs a warning.
    readonly closeInSourceControl: (projectPath: ProjectPath) => Effect.Effect<void>;
    readonly commit: (
      projectPath: ProjectPath,
      commitMessage: string
    ) => Effect.Effect<void, CommitFailed | GitUnavailable>;
    readonly getStagedDiff: (
      projectPath: ProjectPath
    ) => Effect.Effect<string, GitDiffError | GitUnavailable | NothingStaged>;
    // Best effort: a folder that is not a git repository, or git being off, only logs a warning.
    readonly openInSourceControl: (projectPath: ProjectPath) => Effect.Effect<void>;
    // Fills Source Control's commit message box.
    readonly setCommitMessageInput: (
      projectPath: ProjectPath,
      commitMessage: string
    ) => Effect.Effect<void, GitUnavailable>;
    readonly stageAll: (projectPath: ProjectPath) => Effect.Effect<void>;
  }
>()("aggregor/application/clients/git.client/GitClient") {}
