import {Schema} from "effect";

// What a task is, read from its id: Claude Code's background task ids start with a letter per kind.
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
