import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionStatusValueObjectSchema} from "@valueObjects/sessionStatus.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

// What crosses between presentation and the session use cases.

// A session as the list shows it. The kind of wait and the progress are present only while the agent is at its turn,
// and the message only while the agent runs. No icon means its agent is gone from the settings.
export const SessionListItemDtoSchema = Schema.Struct({
  displayName: Schema.String,
  icon: Schema.optional(AgentIconValueObjectSchema),
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

// What changed in the list of projects and their sessions: the projects, which sessions one project has, or one
// session.
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

export const RenameSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type RenameSessionRequestDto = typeof RenameSessionRequestDtoSchema.Type;

export const GetSessionListItemRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type GetSessionListItemRequestDto = typeof GetSessionListItemRequestDtoSchema.Type;

export const ListProjectSessionIdsRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type ListProjectSessionIdsRequestDto = typeof ListProjectSessionIdsRequestDtoSchema.Type;
