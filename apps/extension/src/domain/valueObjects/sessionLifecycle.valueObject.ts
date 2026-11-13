import {Schema} from "effect";

export const SessionLifecycleValueObjectSchema = Schema.Enum({
  ARCHIVED: "archived",
  ONGOING: "ongoing"
});

export const SESSION_LIFECYCLES = SessionLifecycleValueObjectSchema.enums;

export type SessionLifecycleValueObject = typeof SessionLifecycleValueObjectSchema.Type;
