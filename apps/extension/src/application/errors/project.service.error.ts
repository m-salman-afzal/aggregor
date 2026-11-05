import {Data} from "effect";

export class NoProjectError extends Data.TaggedError("NoProjectError") {}
