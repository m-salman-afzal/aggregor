import {BaseEntity} from "@entities/base/base.entity.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";
import {AgentTaskValueObjectSchema} from "@valueObjects/agentTask.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionLifecycleValueObjectSchema} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {SessionRunStateValueObjectSchema} from "@valueObjects/sessionRunState.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// The status fields, tasks, titles and agentSessionId are aggregor-pty's, from the agent's output; the rest are ours.
export class SessionEntity extends BaseEntity.extend<SessionEntity>("Session")({
  agentId: AgentIdValueObjectSchema,
  agentSessionId: Schema.optional(Schema.String),
  // The branch, or detached commit, the project had checked out when Aggregor made the session's worktree.
  baseBranchName: Schema.optional(Schema.String),
  customName: Schema.optional(Schema.String),
  hasWorked: Schema.Boolean,
  // The agent's own id for a conversation imported from its history, which the agent's arguments resume.
  importedAgentSessionId: Schema.optional(Schema.String),
  lifecycle: SessionLifecycleValueObjectSchema,
  name: Schema.String,
  projectId: EntityIdValueObjectSchema,
  projectPath: ProjectPathValueObjectSchema,
  // The pull request the user linked, shown in place of the worktree branch's own.
  pullRequestNumber: Schema.optional(Schema.Int),
  reportedTitle: Schema.optional(Schema.String),
  runState: Schema.optional(SessionRunStateValueObjectSchema),
  status: AgentStatusValueObjectSchema,
  statusChangedAt: Schema.optional(Schema.DateTimeUtcFromString),
  statusKind: Schema.optional(StatusKindValueObjectSchema),
  statusMessage: Schema.optional(Schema.String),
  statusProgress: Schema.optional(Schema.Int),
  tasks: Schema.fromJsonString(Schema.Array(AgentTaskValueObjectSchema)),
  terminalTitle: Schema.optional(Schema.String),
  viewedAt: Schema.optional(Schema.DateTimeUtcFromString),
  worktreePath: Schema.optional(ProjectPathValueObjectSchema)
}) {
  // What ${sessionId} fills in: the id Aggregor starts the agent's conversation with, or the imported one's.
  public get conversationId(): string {
    return this.importedAgentSessionId === undefined ? this.id : this.importedAgentSessionId;
  }

  public get displayName(): string {
    return this.customName === undefined ? this.name : this.customName;
  }

  // An imported conversation resumes, though the agent hasn't worked in Aggregor yet.
  public get hasConversation(): boolean {
    return this.hasWorked || this.importedAgentSessionId !== undefined;
  }

  // What ${agentSessionId} fills in: the id the agent last reported, or the imported one's until it reports.
  public get latestAgentSessionId(): string | undefined {
    return this.agentSessionId === undefined ? this.importedAgentSessionId : this.agentSessionId;
  }

  public get workingFolderPath(): ProjectPathValueObject {
    return this.worktreePath === undefined ? this.projectPath : this.worktreePath;
  }
}
