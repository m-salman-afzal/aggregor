import {Schema} from "effect";

// The command that starts a session's agent, and its arguments.
export const LaunchPlanValueObjectSchema = Schema.Struct({
  command: Schema.NonEmptyString,
  commandArguments: Schema.Array(Schema.String)
});

export type LaunchPlanValueObject = typeof LaunchPlanValueObjectSchema.Type;
