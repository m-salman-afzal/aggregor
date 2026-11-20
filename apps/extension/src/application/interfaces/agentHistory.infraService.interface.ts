import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {Context, Schema} from "effect";

import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export interface AgentConversation {
  readonly agentSessionId: string;
  readonly title: string;
  readonly updatedAtMillis: number;
}

export class IAgentHistoryInfraServiceErrors extends TaggedErrors({
  AgentHistoryNotReadError: {agentId: AgentIdValueObjectSchema},
  AgentHistoryReadFailedError: {agentId: AgentIdValueObjectSchema, cause: Schema.Unknown}
}) {}

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
