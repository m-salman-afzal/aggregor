import {Data} from "effect";

export class RevealFailedError extends Data.TaggedError("RevealFailedError")<{readonly cause: unknown}> {}
