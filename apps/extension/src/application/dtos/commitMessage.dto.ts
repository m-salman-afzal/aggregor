import {Schema} from "effect";

import {ProjectPathValueObjectSchema} from "@/valueObjects/projectPath.valueObject.ts";

export const GenerateCommitMessageRequestDtoSchema = Schema.Struct({
  projectPath: Schema.optional(ProjectPathValueObjectSchema)
});

export type GenerateCommitMessageRequestDto = typeof GenerateCommitMessageRequestDtoSchema.Type;
