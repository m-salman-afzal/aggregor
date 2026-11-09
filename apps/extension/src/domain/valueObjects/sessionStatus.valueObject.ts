import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";

// What a session's row shows: its agent's status, except that done means a finished turn the user has not seen yet.
export const SessionStatusValueObjectSchema = AgentStatusValueObjectSchema.pick([
  "idle",
  "working",
  "done",
  "blocked",
  "error",
  "exited"
]);

export type SessionStatusValueObject = typeof SessionStatusValueObjectSchema.Type;
