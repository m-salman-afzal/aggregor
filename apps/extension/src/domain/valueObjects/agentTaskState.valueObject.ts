import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {Schema} from "effect";

// The states an OSC 7501 report names; clear removes the task instead.
export const AgentTaskStateValueObjectSchema = Schema.Enum({
  BLOCKED: AGENT_STATUSES.BLOCKED,
  DONE: AGENT_STATUSES.DONE,
  ERROR: AGENT_STATUSES.ERROR,
  IDLE: AGENT_STATUSES.IDLE,
  WORKING: AGENT_STATUSES.WORKING
});

export const AGENT_TASK_STATES = AgentTaskStateValueObjectSchema.enums;

export type AgentTaskStateValueObject = typeof AgentTaskStateValueObjectSchema.Type;
