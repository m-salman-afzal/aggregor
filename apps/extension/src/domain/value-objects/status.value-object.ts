import {Schema} from "effect";

// What a session's agent is doing, as its hooks report it.
export const StatusSchema = Schema.Literals(["running", "needs-input", "idle", "exited"]);

export type Status = typeof StatusSchema.Type;
