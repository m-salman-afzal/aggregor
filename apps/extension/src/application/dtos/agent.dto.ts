import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {Schema} from "effect";

// What crosses between the agent picker and the session use cases.

// An agent as the picker lists it.
export const AgentListItemDtoSchema = Schema.Struct({
  agentId: AgentIdValueObjectSchema,
  command: Schema.NonEmptyString,
  icon: AgentIconValueObjectSchema,
  isDefault: Schema.Boolean,
  name: Schema.NonEmptyString
});

export type AgentListItemDto = typeof AgentListItemDtoSchema.Type;
