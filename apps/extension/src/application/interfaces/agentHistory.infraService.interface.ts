import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
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

export class IAgentHistoryInfraServiceErrors extends TaggedErrors({
  // Aggregor reads no history for this agent: Antigravity resumes only its latest conversation, and custom agents vary.
  AgentHistoryNotReadError: {agentId: AgentIdValueObjectSchema},
  // The agent's store is missing, or isn't in the shape Aggregor reads; the span says which.
  AgentHistoryReadFailedError: {agentId: AgentIdValueObjectSchema, cause: Schema.Unknown}
}) {}

// Read from each agent's own store when asked, so a conversation had since shows up.
export class IAgentHistoryInfraService extends Context.Service<
  IAgentHistoryInfraService,
  {
    readonly listAgentConversations: (
      agentId: AgentIdValueObject,
      folderPath: ProjectPathValueObject
    ) => Effect.Effect<
      readonly AgentConversation[],
      IAgentHistoryInfraServiceErrors["AgentHistoryNotReadError" | "AgentHistoryReadFailedError"]
    >;
  }
>()("aggregor-app/application/interfaces/agentHistory.infraService.interface/IAgentHistoryInfraService") {}
