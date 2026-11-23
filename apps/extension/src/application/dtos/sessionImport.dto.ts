import {Schema} from "effect";

import {WorktreeListItemDtoSchema} from "@/dtos/session.dto.ts";
import {AgentIdValueObjectSchema} from "@/valueObjects/agentId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@/valueObjects/projectPath.valueObject.ts";

export const ListImportableSessionsRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type ListImportableSessionsRequestDto = typeof ListImportableSessionsRequestDtoSchema.Type;

export const ImportableSessionDtoSchema = Schema.Struct({
  agentSessionId: Schema.NonEmptyString,
  title: Schema.String,
  updatedAt: Schema.String,
  worktree: Schema.optional(WorktreeListItemDtoSchema)
});

export type ImportableSessionDto = typeof ImportableSessionDtoSchema.Type;

export const AgentImportableSessionsDtoSchema = Schema.Struct({
  agentId: AgentIdValueObjectSchema,
  agentName: Schema.String,
  importableSessions: Schema.Array(ImportableSessionDtoSchema)
});

export type AgentImportableSessionsDto = typeof AgentImportableSessionsDtoSchema.Type;

export const ImportableSessionsDtoSchema = Schema.Struct({
  agentGroups: Schema.Array(AgentImportableSessionsDtoSchema),
  projectPath: ProjectPathValueObjectSchema
});

export type ImportableSessionsDto = typeof ImportableSessionsDtoSchema.Type;

export const ImportedSessionDtoSchema = Schema.Struct({
  agentId: AgentIdValueObjectSchema,
  agentSessionId: Schema.NonEmptyString,
  title: Schema.String,
  worktreePath: Schema.optional(ProjectPathValueObjectSchema)
});

export type ImportedSessionDto = typeof ImportedSessionDtoSchema.Type;

export const ImportSessionsRequestDtoSchema = Schema.Struct({
  importedSessions: Schema.Array(ImportedSessionDtoSchema),
  projectPath: ProjectPathValueObjectSchema
});

export type ImportSessionsRequestDto = typeof ImportSessionsRequestDtoSchema.Type;
