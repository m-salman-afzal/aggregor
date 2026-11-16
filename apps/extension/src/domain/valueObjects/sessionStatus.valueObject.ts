import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {SESSION_RUN_STATES} from "@valueObjects/sessionRunState.valueObject.ts";
import {Schema} from "effect";

// The agent's status, except that done means a finished turn the user has not seen yet, and interrupted an agent cut off.
export const SessionStatusValueObjectSchema = Schema.Enum({
  BLOCKED: AGENT_STATUSES.BLOCKED,
  DONE: AGENT_STATUSES.DONE,
  ERROR: AGENT_STATUSES.ERROR,
  EXITED: AGENT_STATUSES.EXITED,
  IDLE: AGENT_STATUSES.IDLE,
  INTERRUPTED: SESSION_RUN_STATES.INTERRUPTED,
  WORKING: AGENT_STATUSES.WORKING
});

export const SESSION_STATUSES = SessionStatusValueObjectSchema.enums;

export type SessionStatusValueObject = typeof SessionStatusValueObjectSchema.Type;
