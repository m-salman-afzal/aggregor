import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

export const GenerateCommitMessageRequestDtoSchema = Schema.Struct({
  projectPath: Schema.optional(ProjectPathValueObjectSchema)
});

export type GenerateCommitMessageRequestDto = typeof GenerateCommitMessageRequestDtoSchema.Type;
