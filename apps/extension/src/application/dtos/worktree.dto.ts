import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

export const LeftoverWorktreeDtoSchema = Schema.Struct({
  branchName: Schema.String,
  hasChanges: Schema.Boolean,
  worktreeName: Schema.String,
  worktreePath: ProjectPathValueObjectSchema
});

export type LeftoverWorktreeDto = typeof LeftoverWorktreeDtoSchema.Type;

// Merged: its upstream is gone from origin, or its last commit is in the base branch.
export const LeftoverBranchDtoSchema = Schema.Struct({branchName: Schema.String, isMerged: Schema.Boolean});

export type LeftoverBranchDto = typeof LeftoverBranchDtoSchema.Type;

export const ProjectLeftoversDtoSchema = Schema.Struct({
  baseBranchName: Schema.String,
  branches: Schema.Array(LeftoverBranchDtoSchema),
  projectPath: ProjectPathValueObjectSchema,
  worktrees: Schema.Array(LeftoverWorktreeDtoSchema)
});

export type ProjectLeftoversDto = typeof ProjectLeftoversDtoSchema.Type;

export const ListProjectLeftoversRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type ListProjectLeftoversRequestDto = typeof ListProjectLeftoversRequestDtoSchema.Type;

export const CleanUpProjectLeftoversRequestDtoSchema = Schema.Struct({
  branchNames: Schema.Array(Schema.String),
  projectPath: ProjectPathValueObjectSchema,
  worktreePaths: Schema.Array(ProjectPathValueObjectSchema)
});

export type CleanUpProjectLeftoversRequestDto = typeof CleanUpProjectLeftoversRequestDtoSchema.Type;
