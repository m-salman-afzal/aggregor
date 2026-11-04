import {Schema} from "effect";

// The coding agent a session runs.
export type HarnessIdValueObject = typeof HarnessIdValueObjectSchema.Type;

export const HarnessIdValueObjectSchema = Schema.Literals(["claude-code"]);
