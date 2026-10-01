// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class CommitCliError extends Data.TaggedError("CommitCliError") {}
export class GitDiffError extends Data.TaggedError("GitDiffError") {}
export class GitExtensionDisabled extends Data.TaggedError("GitExtensionDisabled") {}
export class GitExtensionUnavailable extends Data.TaggedError("GitExtensionUnavailable") {}
export class GitRepositoryUnavailable extends Data.TaggedError("GitRepositoryUnavailable") {}
export class NothingStaged extends Data.TaggedError("NothingStaged") {}
export class RootUriUnavailable extends Data.TaggedError("RootUriUnavailable") {}
