import {Schema} from "effect";

const ENVIRONMENT_VARIABLE_NAME = /^[A-Z_a-z]\w*$/u;

export const EnvironmentVariablesValueObjectSchema = Schema.Record(
  Schema.String.check(Schema.isPattern(ENVIRONMENT_VARIABLE_NAME)),
  Schema.String
);

export type EnvironmentVariablesValueObject = typeof EnvironmentVariablesValueObjectSchema.Type;
