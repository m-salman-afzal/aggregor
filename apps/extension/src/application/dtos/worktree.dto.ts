import {Schema} from "effect";

import {ProjectPathValueObjectSchema} from "@/valueObjects/projectPath.valueObject.ts";

export const LeftoverWorktreeDtoSchema = Schema.Struct({
  branchName: Schema.String,
  hasChanges: Schema.Boolean,
  worktreeName: Schema.String,
  worktreePath: ProjectPathValueObjectSchema
});

export type LeftoverWorktreeDto = typeof LeftoverWorktreeDtoSchema.Type;

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

export const ListProjectBranchesRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type ListProjectBranchesRequestDto = typeof ListProjectBranchesRequestDtoSchema.Type;

export const ProjectBranchesDtoSchema = Schema.Struct({
  currentBranchName: Schema.optional(Schema.String),
  isFetchingRemote: Schema.Boolean,
  localBranchNames: Schema.Array(Schema.String),
  projectPath: ProjectPathValueObjectSchema,
  remoteBranchNames: Schema.Array(Schema.String)
});

export type ProjectBranchesDto = typeof ProjectBranchesDtoSchema.Type;
