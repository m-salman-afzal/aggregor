import {Schema} from "effect";

// How an agent looks in its sessions' rows, tabs and notifications: the absolute path of an SVG or PNG image.
export const AgentIconValueObjectSchema = Schema.NonEmptyString;

export type AgentIconValueObject = typeof AgentIconValueObjectSchema.Type;
