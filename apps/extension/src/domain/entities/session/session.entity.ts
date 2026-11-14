import {BaseEntity} from "@entities/base/base.entity.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionLifecycleValueObjectSchema} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// The status fields, titles and agentSessionId are aggregor-pty's, from the agent's output; the rest are ours.
export class SessionEntity extends BaseEntity.extend<SessionEntity>("Session")({
  agentId: AgentIdValueObjectSchema,
  agentSessionId: Schema.optional(Schema.String),
  customName: Schema.optional(Schema.String),
  hasWorked: Schema.Boolean,
  lifecycle: SessionLifecycleValueObjectSchema,
  name: Schema.String,
  projectId: EntityIdValueObjectSchema,
  projectPath: ProjectPathValueObjectSchema,
  reportedTitle: Schema.optional(Schema.String),
  status: AgentStatusValueObjectSchema,
  statusChangedAt: Schema.optional(Schema.DateTimeUtcFromString),
  statusKind: Schema.optional(StatusKindValueObjectSchema),
  statusMessage: Schema.optional(Schema.String),
  statusProgress: Schema.optional(Schema.Int),
  terminalTitle: Schema.optional(Schema.String),
  viewedAt: Schema.optional(Schema.DateTimeUtcFromString),
  worktreePath: Schema.optional(ProjectPathValueObjectSchema)
}) {
  public get displayName(): string {
    return this.customName === undefined ? this.name : this.customName;
  }

  public get workingFolderPath(): ProjectPathValueObject {
    return this.worktreePath === undefined ? this.projectPath : this.worktreePath;
  }
}
