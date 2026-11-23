import {Schema} from "effect";

import {AgentTaskStateValueObjectSchema} from "@/valueObjects/agentTaskState.valueObject.ts";
import {StatusKindValueObjectSchema} from "@/valueObjects/statusKind.valueObject.ts";

export const AgentTaskValueObjectSchema = Schema.Struct({
  kind: Schema.optional(StatusKindValueObjectSchema),
  message: Schema.optional(Schema.String),
  progress: Schema.optional(Schema.Int),
  state: AgentTaskStateValueObjectSchema,
  taskId: Schema.String,
  title: Schema.optional(Schema.String)
});

export type AgentTaskValueObject = typeof AgentTaskValueObjectSchema.Type;
