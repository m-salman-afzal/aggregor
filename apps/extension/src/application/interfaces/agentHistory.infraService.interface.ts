import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {Context, Schema} from "effect";

import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

// The id is the one the agent's built-in arguments resume with, in place of Aggregor's session id.
export interface AgentConversation {
  readonly agentSessionId: string;
  readonly title: string;
  readonly updatedAtMillis: number;
}

// Aggregor reads no history for this agent: Antigravity resumes only its latest conversation, and custom agents vary.
export class AgentHistoryNotReadError extends Schema.TaggedError<
  AgentHistoryNotReadError,
  {readonly brand: unique symbol}
>()("AgentHistoryNotReadError", {agentId: AgentIdValueObjectSchema}) {}
// The agent's store is missing, or isn't in the shape Aggregor reads; the span says which.
export class AgentHistoryReadFailedError extends Schema.TaggedError<
  AgentHistoryReadFailedError,
  {readonly brand: unique symbol}
>()("AgentHistoryReadFailedError", {agentId: AgentIdValueObjectSchema, cause: Schema.Unknown}) {}

// Read from each agent's own store when asked, so a conversation had since shows up.
export class IAgentHistoryInfraService extends Context.Service<
  IAgentHistoryInfraService,
  {
    readonly listAgentConversations: (
      agentId: AgentIdValueObject,
      folderPath: ProjectPathValueObject
    ) => Effect.Effect<readonly AgentConversation[], AgentHistoryNotReadError | AgentHistoryReadFailedError>;
  }
>()("aggregor-app/application/interfaces/agentHistory.infraService.interface/IAgentHistoryInfraService") {}
