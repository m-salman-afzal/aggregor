import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionStatusValueObjectSchema} from "@valueObjects/sessionStatus.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

// The wait kind and progress exist only at the agent's turn; no agent name or icon means it left the settings.
export const SessionListItemDtoSchema = Schema.Struct({
  agentName: Schema.optional(Schema.String),
  canMoveDown: Schema.Boolean,
  canMoveUp: Schema.Boolean,
  displayName: Schema.String,
  icon: Schema.optional(AgentIconValueObjectSchema),
  isAgentRunning: Schema.Boolean,
  isArchived: Schema.Boolean,
  name: Schema.String,
  projectName: Schema.String,
  projectPath: ProjectPathValueObjectSchema,
  sessionId: EntityIdValueObjectSchema,
  status: SessionStatusValueObjectSchema,
  statusKind: Schema.optional(StatusKindValueObjectSchema),
  statusMessage: Schema.optional(Schema.String),
  statusProgress: Schema.optional(Schema.Int)
});

export type SessionListItemDto = typeof SessionListItemDtoSchema.Type;

export const SessionListChangeDtoSchema = Schema.TaggedUnion({
  ProjectListChanged: {},
  ProjectSessionsChanged: {projectPath: ProjectPathValueObjectSchema},
  SessionChanged: {sessionId: EntityIdValueObjectSchema}
});

export type SessionListChangeDto = typeof SessionListChangeDtoSchema.Type;

// Without a project, the user picks one.
export const NewSessionRequestDtoSchema = Schema.Struct({projectPath: Schema.optional(ProjectPathValueObjectSchema)});

export type NewSessionRequestDto = typeof NewSessionRequestDtoSchema.Type;

export const OpenSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type OpenSessionRequestDto = typeof OpenSessionRequestDtoSchema.Type;

export const RemoveSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type RemoveSessionRequestDto = typeof RemoveSessionRequestDtoSchema.Type;

export const ArchiveSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type ArchiveSessionRequestDto = typeof ArchiveSessionRequestDtoSchema.Type;

export const ArchiveProjectSessionsRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type ArchiveProjectSessionsRequestDto = typeof ArchiveProjectSessionsRequestDtoSchema.Type;

export const UnarchiveSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type UnarchiveSessionRequestDto = typeof UnarchiveSessionRequestDtoSchema.Type;

export const StopSessionAgentRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type StopSessionAgentRequestDto = typeof StopSessionAgentRequestDtoSchema.Type;

export const StopProjectSessionAgentsRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type StopProjectSessionAgentsRequestDto = typeof StopProjectSessionAgentsRequestDtoSchema.Type;

export const StopArchivedProjectSessionAgentsRequestDtoSchema = Schema.Struct({
  projectPath: ProjectPathValueObjectSchema
});

export type StopArchivedProjectSessionAgentsRequestDto = typeof StopArchivedProjectSessionAgentsRequestDtoSchema.Type;

export const RenameSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type RenameSessionRequestDto = typeof RenameSessionRequestDtoSchema.Type;

export const MoveSessionUpRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type MoveSessionUpRequestDto = typeof MoveSessionUpRequestDtoSchema.Type;

export const MoveSessionDownRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type MoveSessionDownRequestDto = typeof MoveSessionDownRequestDtoSchema.Type;

export const MoveSessionToPlaceOfRequestDtoSchema = Schema.Struct({
  placeOfSessionId: EntityIdValueObjectSchema,
  sessionId: EntityIdValueObjectSchema
});

export type MoveSessionToPlaceOfRequestDto = typeof MoveSessionToPlaceOfRequestDtoSchema.Type;

export const GetSessionListItemRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type GetSessionListItemRequestDto = typeof GetSessionListItemRequestDtoSchema.Type;

export const ListProjectSessionIdsRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type ListProjectSessionIdsRequestDto = typeof ListProjectSessionIdsRequestDtoSchema.Type;

export const ListArchivedProjectSessionIdsRequestDtoSchema = Schema.Struct({
  projectPath: ProjectPathValueObjectSchema
});

export type ListArchivedProjectSessionIdsRequestDto = typeof ListArchivedProjectSessionIdsRequestDtoSchema.Type;
