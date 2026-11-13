import {Schema} from "effect";

// Its key in aggregorApp.agents, such as claude.
export const AgentIdValueObjectSchema = Schema.NonEmptyString.pipe(Schema.brand("AgentId"));

export type AgentIdValueObject = typeof AgentIdValueObjectSchema.Type;
