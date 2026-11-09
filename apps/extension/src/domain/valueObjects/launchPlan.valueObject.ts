import {EnvironmentVariablesValueObjectSchema} from "@valueObjects/environmentVariables.valueObject.ts";
import {Schema} from "effect";

// The command that starts a session's agent, with the arguments that start a new conversation or resume the session's
// own, and the variables it starts with.
export const LaunchPlanValueObjectSchema = Schema.Struct({
  command: Schema.NonEmptyString,
  commandArguments: Schema.Array(Schema.String),
  environmentVariables: EnvironmentVariablesValueObjectSchema
});

export type LaunchPlanValueObject = typeof LaunchPlanValueObjectSchema.Type;
