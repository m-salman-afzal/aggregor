// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class ProjectsCorrupt extends Data.TaggedError("ProjectsCorrupt")<{readonly cause: unknown}> {}
export class ProjectsSaveFailed extends Data.TaggedError("ProjectsSaveFailed")<{readonly cause: unknown}> {}
