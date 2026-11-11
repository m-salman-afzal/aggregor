import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

// What crosses between presentation and the project use cases.

// A project as the list shows it: one of the window's workspace folders, or a project the user added. Only an added
// project moves, among the added ones.
export const ProjectListItemDtoSchema = Schema.Struct({
  canMoveDown: Schema.Boolean,
  canMoveUp: Schema.Boolean,
  isAdded: Schema.Boolean,
  name: Schema.String,
  path: ProjectPathValueObjectSchema
});

export type ProjectListItemDto = typeof ProjectListItemDtoSchema.Type;

export const GetProjectListItemRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type GetProjectListItemRequestDto = typeof GetProjectListItemRequestDtoSchema.Type;

export const RemoveProjectRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type RemoveProjectRequestDto = typeof RemoveProjectRequestDtoSchema.Type;

export const MoveProjectUpRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectUpRequestDto = typeof MoveProjectUpRequestDtoSchema.Type;

export const MoveProjectDownRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectDownRequestDto = typeof MoveProjectDownRequestDtoSchema.Type;

// The added project takes the place of the other added project.
export const MoveProjectToPlaceOfRequestDtoSchema = Schema.Struct({
  placeOfProjectPath: ProjectPathValueObjectSchema,
  projectPath: ProjectPathValueObjectSchema
});

export type MoveProjectToPlaceOfRequestDto = typeof MoveProjectToPlaceOfRequestDtoSchema.Type;
