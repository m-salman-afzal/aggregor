import {Schema} from "effect";

// What a blocked session waits for, when its agent says.
export type StatusKindValueObject = typeof StatusKindValueObjectSchema.Type;

export const StatusKindValueObjectSchema = Schema.Literals(["permission", "question", "auth"]);
