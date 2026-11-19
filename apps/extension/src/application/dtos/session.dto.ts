import {ProjectListItemDtoSchema} from "@dtos/project.dto.ts";
import {WORKING_TREE_CHOICE_TAGS} from "@pkg/constants/src/session.constant.ts";
import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {AgentTaskKindValueObjectSchema} from "@valueObjects/agentTaskKind.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {PullRequestStateValueObjectSchema} from "@valueObjects/pullRequestState.valueObject.ts";
import {SessionStatusValueObjectSchema} from "@valueObjects/sessionStatus.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

export const SessionDiffStatsDtoSchema = Schema.Struct({
  changedFileCount: Schema.Int,
  deletionCount: Schema.Int,
  insertionCount: Schema.Int
});

export type SessionDiffStatsDto = typeof SessionDiffStatsDtoSchema.Type;

// The pull request whose head is the worktree's branch, as gh last found it.
export const SessionPullRequestDtoSchema = Schema.Struct({
  number: Schema.Int,
  state: PullRequestStateValueObjectSchema,
  title: Schema.String
});

export type SessionPullRequestDto = typeof SessionPullRequestDtoSchema.Type;

// One of the agent's tasks, such as a Claude Code sub-agent, named by its title or else its id.
export const SessionTaskDtoSchema = Schema.Struct({
  displayName: Schema.String,
  kind: AgentTaskKindValueObjectSchema,
  state: SessionStatusValueObjectSchema,
  statusMessage: Schema.optional(Schema.String),
  statusProgress: Schema.optional(Schema.Int),
  taskId: Schema.String
});

export type SessionTaskDto = typeof SessionTaskDtoSchema.Type;

// The wait kind and progress exist only at the agent's turn; no agent name or icon means it left the settings.
export const SessionListItemDtoSchema = Schema.Struct({
  agentConversationId: Schema.optional(Schema.String),
  agentName: Schema.optional(Schema.String),
  branchName: Schema.optional(Schema.String),
  canMoveDown: Schema.Boolean,
  canMoveUp: Schema.Boolean,
  diffStats: Schema.optional(SessionDiffStatsDtoSchema),
  displayName: Schema.String,
  icon: Schema.optional(AgentIconValueObjectSchema),
  isAgentRunning: Schema.Boolean,
  isArchived: Schema.Boolean,
  isPullRequestLinked: Schema.Boolean,
  name: Schema.String,
  projectName: Schema.String,
  projectPath: ProjectPathValueObjectSchema,
  pullRequest: Schema.optional(SessionPullRequestDtoSchema),
  sessionId: EntityIdValueObjectSchema,
  status: SessionStatusValueObjectSchema,
  statusKind: Schema.optional(StatusKindValueObjectSchema),
  statusMessage: Schema.optional(Schema.String),
  statusProgress: Schema.optional(Schema.Int),
  tasks: Schema.Array(SessionTaskDtoSchema),
  worktreePath: Schema.optional(ProjectPathValueObjectSchema)
});

export type SessionListItemDto = typeof SessionListItemDtoSchema.Type;

export const WorktreeListItemDtoSchema = Schema.Struct({
  branchName: Schema.String,
  worktreePath: ProjectPathValueObjectSchema
});

export type WorktreeListItemDto = typeof WorktreeListItemDtoSchema.Type;

// The hidden sessions are those on the pages not yet shown; the waiting ones among them still count in the badge.
export const SessionPageDtoSchema = Schema.Struct({
  hiddenSessionCount: Schema.Int,
  hiddenWaitingCount: Schema.Int,
  totalSessionCount: Schema.Int
});

export type SessionPageDto = typeof SessionPageDtoSchema.Type;

// Without worktrees, the project is no git repository, or the list doesn't read them (the Archive).
export const ProjectSessionsDtoSchema = Schema.Struct({
  hasLeftovers: Schema.optional(Schema.Boolean),
  projectListItem: ProjectListItemDtoSchema,
  sessionListItems: Schema.Array(SessionListItemDtoSchema),
  sessionPage: SessionPageDtoSchema,
  worktrees: Schema.optional(Schema.Array(WorktreeListItemDtoSchema)),
  worktreesRootPath: Schema.optional(Schema.String)
});

export type ProjectSessionsDto = typeof ProjectSessionsDtoSchema.Type;

export const SessionListChangeDtoSchema = Schema.TaggedUnion({
  ProjectListChanged: {},
  ProjectSessionsChanged: {projectPath: ProjectPathValueObjectSchema},
  SessionChanged: {sessionId: EntityIdValueObjectSchema}
});

export type SessionListChangeDto = typeof SessionListChangeDtoSchema.Type;

// Without an agent, the default one starts, or the only one installed.
export const WorkingTreeChoiceDtoSchema = Schema.TaggedUnion({
  [WORKING_TREE_CHOICE_TAGS.EXISTING_WORKTREE]: {worktreePath: ProjectPathValueObjectSchema},
  // Without a base branch, the worktree starts from the project's current commit.
  [WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE]: {baseBranchName: Schema.optional(Schema.NonEmptyString)},
  [WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT]: {}
});

export type WorkingTreeChoiceDto = typeof WorkingTreeChoiceDtoSchema.Type;

export const NewSessionRequestDtoSchema = Schema.Struct({
  agentId: Schema.optional(AgentIdValueObjectSchema),
  projectPath: ProjectPathValueObjectSchema,
  workingTree: WorkingTreeChoiceDtoSchema
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

export const RenameSessionBranchRequestDtoSchema = Schema.Struct({
  branchName: Schema.NonEmptyString,
  sessionId: EntityIdValueObjectSchema
});

export type RenameSessionBranchRequestDto = typeof RenameSessionBranchRequestDtoSchema.Type;

export const ChangeSessionWorkingTreeRequestDtoSchema = Schema.Struct({
  sessionId: EntityIdValueObjectSchema,
  workingTree: WorkingTreeChoiceDtoSchema
});

export type ChangeSessionWorkingTreeRequestDto = typeof ChangeSessionWorkingTreeRequestDtoSchema.Type;

export const UnlinkSessionWorktreeRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type UnlinkSessionWorktreeRequestDto = typeof UnlinkSessionWorktreeRequestDtoSchema.Type;

export const MoveSessionUpRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type MoveSessionUpRequestDto = typeof MoveSessionUpRequestDtoSchema.Type;

export const MoveSessionDownRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type MoveSessionDownRequestDto = typeof MoveSessionDownRequestDtoSchema.Type;

export const GetSessionListItemRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type GetSessionListItemRequestDto = typeof GetSessionListItemRequestDtoSchema.Type;

const ShownPageCountSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

export const GetProjectSessionsRequestDtoSchema = Schema.Struct({
  projectPath: ProjectPathValueObjectSchema,
  shownPageCount: ShownPageCountSchema
});

export type GetProjectSessionsRequestDto = typeof GetProjectSessionsRequestDtoSchema.Type;

// A project with no count shows its first page.
export const ListProjectSessionsRequestDtoSchema = Schema.Struct({
  shownPageCounts: Schema.Record(Schema.String, ShownPageCountSchema)
});

export type ListProjectSessionsRequestDto = typeof ListProjectSessionsRequestDtoSchema.Type;
