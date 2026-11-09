import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

// What crosses between presentation and the project use cases.

// A project as the list shows it: one of the window's workspace folders, or a project the user added.
export const ProjectListItemDtoSchema = Schema.Struct({
  isAdded: Schema.Boolean,
  name: Schema.String,
  path: ProjectPathValueObjectSchema
});

export type ProjectListItemDto = typeof ProjectListItemDtoSchema.Type;

export const GetProjectListItemRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type GetProjectListItemRequestDto = typeof GetProjectListItemRequestDtoSchema.Type;

export const RemoveProjectRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type RemoveProjectRequestDto = typeof RemoveProjectRequestDtoSchema.Type;
