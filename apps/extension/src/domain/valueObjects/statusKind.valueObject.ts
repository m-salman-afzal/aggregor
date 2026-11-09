import {Schema} from "effect";

// What a blocked session waits for, when its agent says.
export const StatusKindValueObjectSchema = Schema.Enum({
  AUTH: "auth",
  PERMISSION: "permission",
  QUESTION: "question"
});

export const STATUS_KINDS = StatusKindValueObjectSchema.enums;

export type StatusKindValueObject = typeof StatusKindValueObjectSchema.Type;
