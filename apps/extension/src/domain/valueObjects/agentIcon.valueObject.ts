import {Schema} from "effect";

export const AgentIconValueObjectSchema = Schema.NonEmptyString;

export type AgentIconValueObject = typeof AgentIconValueObjectSchema.Type;
