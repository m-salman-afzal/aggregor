import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

// A turn that ended in idle arrives as done; no icon means the agent left the settings.
export const SessionAlertDtoSchema = Schema.Struct({
  displayName: Schema.String,
  icon: Schema.optional(AgentIconValueObjectSchema),
  sessionId: EntityIdValueObjectSchema,
  status: AgentStatusValueObjectSchema,
  statusKind: Schema.optional(StatusKindValueObjectSchema),
  statusMessage: Schema.optional(Schema.String)
});

export type SessionAlertDto = typeof SessionAlertDtoSchema.Type;

export const NotifyOnDesktopRequestDtoSchema = Schema.Struct({
  agentIconPath: Schema.optional(Schema.String),
  aggregorIconPath: Schema.String,
  headline: Schema.String,
  message: Schema.String,
  openLink: Schema.String
});

export type NotifyOnDesktopRequestDto = typeof NotifyOnDesktopRequestDtoSchema.Type;
