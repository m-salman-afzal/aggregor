import {Schema} from "effect";

export const ProjectPathValueObjectSchema = Schema.String.pipe(Schema.brand("ProjectPath"));

export type ProjectPathValueObject = typeof ProjectPathValueObjectSchema.Type;
