import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionStatusValueObjectSchema} from "@valueObjects/sessionStatus.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

// What crosses between presentation and the session use cases.

export type GetSessionListItemRequestDto = typeof GetSessionListItemRequestDtoSchema.Type;

export type ListProjectSessionIdsRequestDto = typeof ListProjectSessionIdsRequestDtoSchema.Type;

export type NewSessionRequestDto = typeof NewSessionRequestDtoSchema.Type;

export type OpenSessionRequestDto = typeof OpenSessionRequestDtoSchema.Type;

export type RemoveSessionRequestDto = typeof RemoveSessionRequestDtoSchema.Type;

export type RenameSessionRequestDto = typeof RenameSessionRequestDtoSchema.Type;

// What changed in the list of projects and their sessions: the projects, which sessions one project has, or one
// session.
export type SessionListChangeDto = typeof SessionListChangeDtoSchema.Type;

// A session as the list shows it. The kind of wait and the progress are present only while the agent is at its turn,
// and the message only while the agent runs.
export type SessionListItemDto = typeof SessionListItemDtoSchema.Type;

export const SessionListItemDtoSchema = Schema.Struct({
  displayName: Schema.String,
  iconPath: Schema.String,
  name: Schema.String,
  projectName: Schema.String,
  projectPath: ProjectPathValueObjectSchema,
  sessionId: EntityIdValueObjectSchema,
  status: SessionStatusValueObjectSchema,
  statusKind: Schema.optional(StatusKindValueObjectSchema),
  statusMessage: Schema.optional(Schema.String),
  statusProgress: Schema.optional(Schema.Int)
});

export const SessionListChangeDtoSchema = Schema.TaggedUnion({
  ProjectListChanged: {},
  ProjectSessionsChanged: {projectPath: ProjectPathValueObjectSchema},
  SessionChanged: {sessionId: EntityIdValueObjectSchema}
});

// Without a project, the user picks one.
export const NewSessionRequestDtoSchema = Schema.Struct({projectPath: Schema.optional(ProjectPathValueObjectSchema)});

export const OpenSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export const RemoveSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export const RenameSessionRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export const GetSessionListItemRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export const ListProjectSessionIdsRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});
