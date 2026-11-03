import {Data} from "effect";

export class InvalidSettings extends Data.TaggedError("InvalidSettings")<{readonly reason: string}> {}
