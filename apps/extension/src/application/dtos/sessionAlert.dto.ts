import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {StatusKindValueObjectSchema} from "@valueObjects/statusKind.valueObject.ts";
import {Schema} from "effect";

// A state a session out of view has held long enough to notify about. A turn that ended in idle arrives as done. No
// icon means its agent is gone from the settings.
export const SessionAlertDtoSchema = Schema.Struct({
  displayName: Schema.String,
  icon: Schema.optional(AgentIconValueObjectSchema),
  sessionId: EntityIdValueObjectSchema,
  status: AgentStatusValueObjectSchema,
  statusKind: Schema.optional(StatusKindValueObjectSchema),
  statusMessage: Schema.optional(Schema.String)
});

export type SessionAlertDto = typeof SessionAlertDtoSchema.Type;

// A notification outside VS Code, for when this window isn't focused; its link opens the session in this window. The
// message is empty when the agent sent none, and the agent's icon is missing when its agent is gone.
export const NotifyOnDesktopRequestDtoSchema = Schema.Struct({
  agentIconPath: Schema.optional(Schema.String),
  aggregorIconPath: Schema.String,
  headline: Schema.String,
  message: Schema.String,
  openLink: Schema.String
});

export type NotifyOnDesktopRequestDto = typeof NotifyOnDesktopRequestDtoSchema.Type;
