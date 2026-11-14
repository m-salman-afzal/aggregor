import {ProjectListItemDtoSchema} from "@dtos/project.dto.ts";
import {NEW_SESSION_WORKING_TREE_TAGS} from "@pkg/constants/src/session.constant.ts";
import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
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
  statusProgress: Schema.optional(Schema.Int),
  worktreePath: Schema.optional(ProjectPathValueObjectSchema)
});

export type SessionListItemDto = typeof SessionListItemDtoSchema.Type;

export const WorktreeListItemDtoSchema = Schema.Struct({
  branchName: Schema.String,
  worktreePath: ProjectPathValueObjectSchema
});

export type WorktreeListItemDto = typeof WorktreeListItemDtoSchema.Type;

// Without worktrees, the project is no git repository, or the list doesn't read them (the Archive).
export const ProjectSessionsDtoSchema = Schema.Struct({
  projectListItem: ProjectListItemDtoSchema,
  sessionListItems: Schema.Array(SessionListItemDtoSchema),
  worktrees: Schema.optional(Schema.Array(WorktreeListItemDtoSchema))
});

export type ProjectSessionsDto = typeof ProjectSessionsDtoSchema.Type;

export const SessionListChangeDtoSchema = Schema.TaggedUnion({
  ProjectListChanged: {},
  ProjectSessionsChanged: {projectPath: ProjectPathValueObjectSchema},
  SessionChanged: {sessionId: EntityIdValueObjectSchema}
});

export type SessionListChangeDto = typeof SessionListChangeDtoSchema.Type;

// Without an agent, the default one starts, or the only one installed.
export const NewSessionRequestDtoSchema = Schema.Struct({
  agentId: Schema.optional(AgentIdValueObjectSchema),
  projectPath: ProjectPathValueObjectSchema,
  workingTree: Schema.TaggedUnion({
    [NEW_SESSION_WORKING_TREE_TAGS.EXISTING_WORKTREE]: {worktreePath: ProjectPathValueObjectSchema},
    [NEW_SESSION_WORKING_TREE_TAGS.NEW_WORKTREE]: {},
    [NEW_SESSION_WORKING_TREE_TAGS.PROJECT_ROOT]: {}
  })
});

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

// An empty name hands the row and the tab back to the agent's title.
export const RenameSessionRequestDtoSchema = Schema.Struct({
  customName: Schema.String,
  sessionId: EntityIdValueObjectSchema
});

export type RenameSessionRequestDto = typeof RenameSessionRequestDtoSchema.Type;

export const MoveSessionUpRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type MoveSessionUpRequestDto = typeof MoveSessionUpRequestDtoSchema.Type;

export const MoveSessionDownRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type MoveSessionDownRequestDto = typeof MoveSessionDownRequestDtoSchema.Type;

export const GetSessionListItemRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type GetSessionListItemRequestDto = typeof GetSessionListItemRequestDtoSchema.Type;

export const ListProjectSessionsRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type ListProjectSessionsRequestDto = typeof ListProjectSessionsRequestDtoSchema.Type;
