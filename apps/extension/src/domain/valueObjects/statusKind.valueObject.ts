import {Schema} from "effect";

export const StatusKindValueObjectSchema = Schema.Enum({
  AUTH: "auth",
  PERMISSION: "permission",
  QUESTION: "question"
});

export const STATUS_KINDS = StatusKindValueObjectSchema.enums;

export type StatusKindValueObject = typeof StatusKindValueObjectSchema.Type;
