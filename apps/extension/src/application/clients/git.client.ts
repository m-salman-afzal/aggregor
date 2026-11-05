import {Context} from "effect";

import type {
  CommitFailed,
  GitDiffError,
  GitExtensionDisabled,
  GitExtensionUnavailable,
  GitRepositoryUnavailable,
  NothingStaged
} from "@/application/errors/git.error.ts";
import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
import type {Effect} from "effect";

// Why the git repository at a path cannot be reached.
export type GitUnavailable = GitExtensionDisabled | GitExtensionUnavailable | GitRepositoryUnavailable;

// The git repositories VS Code's Source Control shows, each named by its root folder.
export class GitClient extends Context.Service<
  GitClient,
  {
    // Best effort: a folder that is not a git repo, or git being off, only logs a warning.
    readonly closeInSourceControl: (repoPath: RepoPath) => Effect.Effect<void>;
    readonly commit: (repoPath: RepoPath, commitMessage: string) => Effect.Effect<void, CommitFailed | GitUnavailable>;
    readonly getStagedDiff: (
      repoPath: RepoPath
    ) => Effect.Effect<string, GitDiffError | GitUnavailable | NothingStaged>;
    // Best effort: a folder that is not a git repo, or git being off, only logs a warning.
    readonly openInSourceControl: (repoPath: RepoPath) => Effect.Effect<void>;
    // Fills Source Control's commit message box.
    readonly setCommitMessageInput: (repoPath: RepoPath, commitMessage: string) => Effect.Effect<void, GitUnavailable>;
    readonly stageAll: (repoPath: RepoPath) => Effect.Effect<void>;
  }
>()("aggregor/application/clients/git.client/GitClient") {}
