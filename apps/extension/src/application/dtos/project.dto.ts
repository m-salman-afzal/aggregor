import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionWorkingTreeValueObjectSchema} from "@valueObjects/sessionWorkingTree.valueObject.ts";
import {Schema} from "effect";

export const ProjectSettingsDtoSchema = Schema.Struct({
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

export const NewProjectTerminalRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type NewProjectTerminalRequestDto = typeof NewProjectTerminalRequestDtoSchema.Type;

export const SaveProjectSettingsRequestDtoSchema = Schema.Struct({
  projectPath: ProjectPathValueObjectSchema,
  settings: ProjectSettingsDtoSchema
});

export type SaveProjectSettingsRequestDto = typeof SaveProjectSettingsRequestDtoSchema.Type;

export const RemoveProjectRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type RemoveProjectRequestDto = typeof RemoveProjectRequestDtoSchema.Type;

export const MoveProjectUpRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectUpRequestDto = typeof MoveProjectUpRequestDtoSchema.Type;

export const MoveProjectDownRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type MoveProjectDownRequestDto = typeof MoveProjectDownRequestDtoSchema.Type;
