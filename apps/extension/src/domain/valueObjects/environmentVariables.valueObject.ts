import {Schema} from "effect";

// A POSIX variable name, so `NAME=value` splits at the first =.
const ENVIRONMENT_VARIABLE_NAME = /^[A-Z_a-z]\w*$/u;

// The variables a harness's agent starts with, such as Claude's CLAUDE_CODE_TMUX_TRUECOLOR.
export const EnvironmentVariablesValueObjectSchema = Schema.Record(
  Schema.String.check(Schema.isPattern(ENVIRONMENT_VARIABLE_NAME)),
  Schema.String
);

export type EnvironmentVariablesValueObject = typeof EnvironmentVariablesValueObjectSchema.Type;
