import {Data} from "effect";

export class RevealFailed extends Data.TaggedError("RevealFailed")<{readonly cause: unknown}> {}
