// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

// Why the git repository at a path cannot be reached.
export type GitUnavailableError =
  GitExtensionDisabledError | GitExtensionUnavailableError | GitRepositoryUnavailableError;

export class CommitFailedError extends Data.TaggedError("CommitFailedError")<{readonly cause: unknown}> {}
export class GitDiffError extends Data.TaggedError("GitDiffError") {}
export class GitExtensionDisabledError extends Data.TaggedError("GitExtensionDisabledError") {}
export class GitExtensionUnavailableError extends Data.TaggedError("GitExtensionUnavailableError") {}
export class GitRepositoryUnavailableError extends Data.TaggedError("GitRepositoryUnavailableError") {}
export class NothingStagedError extends Data.TaggedError("NothingStagedError") {}
