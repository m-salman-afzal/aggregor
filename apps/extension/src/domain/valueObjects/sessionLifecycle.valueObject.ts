import {Schema} from "effect";

// Where a session is in its life: in use in the Sessions view, or archived in the Archive view once the user is done
// with it.
export const SessionLifecycleValueObjectSchema = Schema.Enum({
  ARCHIVED: "archived",
  ONGOING: "ongoing"
});

export const SESSION_LIFECYCLES = SessionLifecycleValueObjectSchema.enums;

export type SessionLifecycleValueObject = typeof SessionLifecycleValueObjectSchema.Type;
