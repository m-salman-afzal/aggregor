import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

// What crosses between presentation and the commit message use case.

// The project is the Source Control's root folder, which a Source Control may lack.
export const GenerateCommitMessageRequestDtoSchema = Schema.Struct({
  projectPath: Schema.optional(ProjectPathValueObjectSchema)
});

export type GenerateCommitMessageRequestDto = typeof GenerateCommitMessageRequestDtoSchema.Type;
