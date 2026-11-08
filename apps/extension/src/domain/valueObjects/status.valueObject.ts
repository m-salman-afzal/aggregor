import {Schema} from "effect";

// What a session's agent is doing: the OSC 7501 states it reports, plus unknown (no report yet, or cleared) and exited
// (the agent is gone), as aggregor-pty records them.
export type StatusValueObject = typeof StatusValueObjectSchema.Type;

export const StatusValueObjectSchema = Schema.Literals([
  "unknown",
  "idle",
  "working",
  "done",
  "blocked",
  "error",
  "exited"
]);
