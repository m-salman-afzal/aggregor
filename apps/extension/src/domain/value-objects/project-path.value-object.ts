import {Schema} from "effect";

// The absolute path of a project's folder on disk.
export const ProjectPathSchema = Schema.String.pipe(Schema.brand("ProjectPath"));

export type ProjectPath = typeof ProjectPathSchema.Type;
