// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class CommitCliError extends Data.TaggedError("CommitCliError")<{
  readonly exitCode: number;
  readonly stderr: string;
}> {}
export class CommitFailed extends Data.TaggedError("CommitFailed")<{readonly cause: unknown}> {}
export class EmptyCommitMessage extends Data.TaggedError("EmptyCommitMessage") {}
export class GitDiffError extends Data.TaggedError("GitDiffError") {}
export class GitExtensionDisabled extends Data.TaggedError("GitExtensionDisabled") {}
export class GitExtensionUnavailable extends Data.TaggedError("GitExtensionUnavailable") {}
export class GitRepositoryUnavailable extends Data.TaggedError("GitRepositoryUnavailable") {}
export class NothingStaged extends Data.TaggedError("NothingStaged") {}
export class RootUriUnavailable extends Data.TaggedError("RootUriUnavailable") {}
