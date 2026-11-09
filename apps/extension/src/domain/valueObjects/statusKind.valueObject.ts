import {Schema} from "effect";

// What a blocked session waits for, when its agent says.
export const StatusKindValueObjectSchema = Schema.Literals(["permission", "question", "auth"]);

export type StatusKindValueObject = typeof StatusKindValueObjectSchema.Type;
