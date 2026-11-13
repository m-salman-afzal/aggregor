import {EnvironmentVariablesValueObjectSchema} from "@valueObjects/environmentVariables.valueObject.ts";
import {Schema} from "effect";

export const LaunchPlanValueObjectSchema = Schema.Struct({
  command: Schema.NonEmptyString,
  commandArguments: Schema.Array(Schema.String),
  environmentVariables: EnvironmentVariablesValueObjectSchema
});

export type LaunchPlanValueObject = typeof LaunchPlanValueObjectSchema.Type;
