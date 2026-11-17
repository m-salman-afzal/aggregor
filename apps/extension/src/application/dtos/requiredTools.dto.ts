import {REQUIRED_TOOLS} from "@pkg/constants/src/requiredTools.constant.ts";
import {Schema} from "effect";

// A tmux that is on PATH but too old carries the version found.
export const MissingToolDtoSchema = Schema.Struct({
  foundVersion: Schema.optional(Schema.String),
  toolName: Schema.Literals([REQUIRED_TOOLS.GITHUB_CLI, REQUIRED_TOOLS.TMUX])
});

export type MissingToolDto = typeof MissingToolDtoSchema.Type;

// Without an install command, no package manager Aggregor knows is on PATH.
export const MissingToolsDtoSchema = Schema.Struct({
  installCommandLine: Schema.optional(Schema.String),
  missingTools: Schema.Array(MissingToolDtoSchema)
});

export type MissingToolsDto = typeof MissingToolsDtoSchema.Type;
