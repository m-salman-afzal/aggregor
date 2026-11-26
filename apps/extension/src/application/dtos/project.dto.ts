import {Schema} from "effect";

import {ProjectPathValueObjectSchema} from "@/valueObjects/projectPath.valueObject.ts";
import {SessionWorkingTreeValueObjectSchema} from "@/valueObjects/sessionWorkingTree.valueObject.ts";

export const ProjectSettingsDtoSchema = Schema.Struct({
  cleanUpBaseBranch: Schema.String,
  filesToCopy: Schema.Array(Schema.String),
  newSessionWorkingTree: SessionWorkingTreeValueObjectSchema,
  setupScript: Schema.String,
  worktreeFolder: Schema.String
});

export type ProjectSettingsDto = typeof ProjectSettingsDtoSchema.Type;

export const ProjectListItemDtoSchema = Schema.Struct({
  canMoveDown: Schema.Boolean,
  canMoveUp: Schema.Boolean,
  isAdded: Schema.Boolean,
  name: Schema.String,
  path: ProjectPathValueObjectSchema,
  settings: ProjectSettingsDtoSchema
});

export type ProjectListItemDto = typeof ProjectListItemDtoSchema.Type;

export const SaveProjectSettingsRequestDtoSchema = Schema.Struct({
  projectPath: ProjectPathValueObjectSchema,
  settings: ProjectSettingsDtoSchema
});

export type SaveProjectSettingsRequestDto = typeof SaveProjectSettingsRequestDtoSchema.Type;

export const AddProjectFolderRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type AddProjectFolderRequestDto = typeof AddProjectFolderRequestDtoSchema.Type;

export const RemoveProjectRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type RemoveProjectRequestDto = typeof RemoveProjectRequestDtoSchema.Type;

export const MoveProjectUpRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectUpRequestDto = typeof MoveProjectUpRequestDtoSchema.Type;

export const MoveProjectDownRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectDownRequestDto = typeof MoveProjectDownRequestDtoSchema.Type;
