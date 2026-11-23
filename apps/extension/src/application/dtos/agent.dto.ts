import {Schema} from "effect";

import {AgentIconValueObjectSchema} from "@/valueObjects/agentIcon.valueObject.ts";
import {AgentIdValueObjectSchema} from "@/valueObjects/agentId.valueObject.ts";

export const AgentListItemDtoSchema = Schema.Struct({
  agentId: AgentIdValueObjectSchema,
  command: Schema.NonEmptyString,
  icon: AgentIconValueObjectSchema,
  isDefault: Schema.Boolean,
  name: Schema.NonEmptyString
});

export type AgentListItemDto = typeof AgentListItemDtoSchema.Type;

export const SetDefaultAgentRequestDtoSchema = Schema.Struct({agentId: AgentIdValueObjectSchema});

export type SetDefaultAgentRequestDto = typeof SetDefaultAgentRequestDtoSchema.Type;
