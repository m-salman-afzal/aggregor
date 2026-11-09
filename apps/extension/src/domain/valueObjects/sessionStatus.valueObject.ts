import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {Schema} from "effect";

// What a session's row shows: its agent's status, except that done means a finished turn the user has not seen yet.
export const SessionStatusValueObjectSchema = Schema.Enum({
  BLOCKED: AGENT_STATUSES.BLOCKED,
  DONE: AGENT_STATUSES.DONE,
  ERROR: AGENT_STATUSES.ERROR,
  EXITED: AGENT_STATUSES.EXITED,
  IDLE: AGENT_STATUSES.IDLE,
  WORKING: AGENT_STATUSES.WORKING
});

export const SESSION_STATUSES = SessionStatusValueObjectSchema.enums;

export type SessionStatusValueObject = typeof SessionStatusValueObjectSchema.Type;
