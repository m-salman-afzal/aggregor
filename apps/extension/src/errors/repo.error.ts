// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class NoRepo extends Data.TaggedError("NoRepo") {}
export class RepoPickCancelled extends Data.TaggedError("RepoPickCancelled") {}
export class ReposCorrupt extends Data.TaggedError("ReposCorrupt")<{readonly cause: unknown}> {}
export class ReposSaveFailed extends Data.TaggedError("ReposSaveFailed")<{readonly cause: unknown}> {}
