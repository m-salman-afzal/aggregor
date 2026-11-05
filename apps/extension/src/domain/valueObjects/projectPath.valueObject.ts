import {Schema} from "effect";

// The absolute path of a project's folder on disk.
export type ProjectPathValueObject = typeof ProjectPathValueObjectSchema.Type;

export const ProjectPathValueObjectSchema = Schema.String.pipe(Schema.brand("ProjectPath"));
