import {Schema} from "effect";

// The coding agent a session runs.
export const HarnessIdSchema = Schema.Literals(["claude-code"]);

export type HarnessId = typeof HarnessIdSchema.Type;
