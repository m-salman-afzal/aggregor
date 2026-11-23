import {Schema} from "effect";

import {REQUIRED_TOOLS} from "@pkg/constants/src/requiredTools.constant.ts";

export const MissingToolDtoSchema = Schema.Struct({
  foundVersion: Schema.optional(Schema.String),
  toolName: Schema.Literals([REQUIRED_TOOLS.GITHUB_CLI, REQUIRED_TOOLS.TMUX])
});

export type MissingToolDto = typeof MissingToolDtoSchema.Type;

export const MissingToolsDtoSchema = Schema.Struct({
  installCommandLine: Schema.optional(Schema.String),
  missingTools: Schema.Array(MissingToolDtoSchema)
});

export type MissingToolsDto = typeof MissingToolsDtoSchema.Type;
