import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {SESSION_RUN_STATES} from "@valueObjects/sessionRunState.valueObject.ts";
import {Schema} from "effect";

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
