import {Schema} from "effect";

// Whether Aggregor last saw the session's agent running, or saw a window start with it cut off, as by a restart.
export const SessionRunStateValueObjectSchema = Schema.Enum({
  INTERRUPTED: "interrupted",
  RUNNING: "running"
});

export const SESSION_RUN_STATES = SessionRunStateValueObjectSchema.enums;

export type SessionRunStateValueObject = typeof SessionRunStateValueObjectSchema.Type;
