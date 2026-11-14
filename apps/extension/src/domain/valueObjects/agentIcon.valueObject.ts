import {Schema} from "effect";

// The absolute path of an SVG or PNG image.
export const AgentIconValueObjectSchema = Schema.NonEmptyString;

export type AgentIconValueObject = typeof AgentIconValueObjectSchema.Type;
