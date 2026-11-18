import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

// An OSC 7501 record with an id, beside the agent's own: a Claude Code sub-agent or background shell, as reported.
export const AgentTaskValueObjectSchema = Schema.Struct({
  kind: Schema.optional(StatusKindValueObjectSchema),
  message: Schema.optional(Schema.String),
  progress: Schema.optional(Schema.Int),
  state: AgentStatusValueObjectSchema,
  taskId: Schema.String,
  title: Schema.optional(Schema.String)
});

export type AgentTaskValueObject = typeof AgentTaskValueObjectSchema.Type;
