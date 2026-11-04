// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class SessionsCorruptError extends Data.TaggedError("SessionsCorruptError")<{readonly cause: unknown}> {}
export class SessionsSaveFailedError extends Data.TaggedError("SessionsSaveFailedError")<{readonly cause: unknown}> {}
