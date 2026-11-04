// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class ProjectsCorruptError extends Data.TaggedError("ProjectsCorruptError")<{readonly cause: unknown}> {}
export class ProjectsSaveFailedError extends Data.TaggedError("ProjectsSaveFailedError")<{readonly cause: unknown}> {}
