import {Schema} from "effect";

export const AgentTaskKindValueObjectSchema = Schema.Enum({
  MCP_TASK: "mcpTask",
  MONITOR: "monitor",
  OTHER: "other",
  REMOTE_AGENT: "remoteAgent",
  SHELL: "shell",
  SUB_AGENT: "subAgent",
  TEAMMATE: "teammate",
  WORKFLOW: "workflow"
});

export const AGENT_TASK_KINDS = AgentTaskKindValueObjectSchema.enums;

export type AgentTaskKindValueObject = typeof AgentTaskKindValueObjectSchema.Type;
