import {Schema} from "effect";

// What a session's agent reports it is doing: the OSC 7501 states, plus unknown (no report yet, or cleared) and exited
// (the agent is gone), as aggregor-pty records them.
export const AgentStatusValueObjectSchema = Schema.Enum({
  BLOCKED: "blocked",
  DONE: "done",
  ERROR: "error",
  EXITED: "exited",
  IDLE: "idle",
  UNKNOWN: "unknown",
  WORKING: "working"
});

export const AGENT_STATUSES = AgentStatusValueObjectSchema.enums;

export type AgentStatusValueObject = typeof AgentStatusValueObjectSchema.Type;
