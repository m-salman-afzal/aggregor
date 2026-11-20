import {Schema} from "effect";

export const AgentIdValueObjectSchema = Schema.NonEmptyString.pipe(Schema.brand("AgentId"));

export type AgentIdValueObject = typeof AgentIdValueObjectSchema.Type;
