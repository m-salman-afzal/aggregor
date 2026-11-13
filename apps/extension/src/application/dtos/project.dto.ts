import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

export const ProjectListItemDtoSchema = Schema.Struct({
  canMoveDown: Schema.Boolean,
  canMoveUp: Schema.Boolean,
  isAdded: Schema.Boolean,
  name: Schema.String,
  path: ProjectPathValueObjectSchema
});

export type ProjectListItemDto = typeof ProjectListItemDtoSchema.Type;

export const RemoveProjectRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type RemoveProjectRequestDto = typeof RemoveProjectRequestDtoSchema.Type;

export const MoveProjectUpRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectUpRequestDto = typeof MoveProjectUpRequestDtoSchema.Type;

export const MoveProjectDownRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectDownRequestDto = typeof MoveProjectDownRequestDtoSchema.Type;

export const MoveProjectToPlaceOfRequestDtoSchema = Schema.Struct({
  placeOfProjectPath: ProjectPathValueObjectSchema,
  projectPath: ProjectPathValueObjectSchema
});

export type MoveProjectToPlaceOfRequestDto = typeof MoveProjectToPlaceOfRequestDtoSchema.Type;
