import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {Context} from "effect";

import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {Effect} from "effect";

export class IAgentRepositoryErrors extends TaggedErrors({
  AgentNotFoundError: {agentId: AgentIdValueObjectSchema}
}) {}

export class IAgentRepository extends Context.Service<
  IAgentRepository,
  {
    readonly findAll: Effect.Effect<readonly AgentEntity[]>;
    readonly findById: (
      agentId: AgentIdValueObject
    ) => Effect.Effect<AgentEntity, IAgentRepositoryErrors["AgentNotFoundError"]>;
  }
>()("aggregor-app/domain/entities/agent/agent.repository.interface/IAgentRepository") {}
