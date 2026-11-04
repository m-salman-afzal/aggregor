import {Schema} from "effect";

// What a session's agent is doing, as its hooks report it.
export type StatusValueObject = typeof StatusValueObjectSchema.Type;

export const StatusValueObjectSchema = Schema.Literals(["running", "needs-input", "idle", "exited"]);
