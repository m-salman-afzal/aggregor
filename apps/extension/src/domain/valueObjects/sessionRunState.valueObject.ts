import {Schema} from "effect";

export const SessionRunStateValueObjectSchema = Schema.Enum({
  INTERRUPTED: "interrupted",
  RUNNING: "running"
});

export const SESSION_RUN_STATES = SessionRunStateValueObjectSchema.enums;

export type SessionRunStateValueObject = typeof SessionRunStateValueObjectSchema.Type;
