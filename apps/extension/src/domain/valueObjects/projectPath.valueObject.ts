import {Schema} from "effect";

// The absolute path of a project's folder on disk.
export const ProjectPathValueObjectSchema = Schema.String.pipe(Schema.brand("ProjectPath"));

export type ProjectPathValueObject = typeof ProjectPathValueObjectSchema.Type;
