import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {Context, Schema} from "effect";

import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {Effect} from "effect";

// No agent has that key: it was renamed, hidden with null, or left out as invalid.
export class AgentNotFoundError extends Schema.TaggedError<AgentNotFoundError, {readonly brand: unique symbol}>()(
  "AgentNotFoundError",
  {agentId: AgentIdValueObjectSchema}
) {}

// The agents aggregorApp.agents defines, the built-ins included; an edit applies at once.
export class IAgentRepository extends Context.Service<
  IAgentRepository,
  {
    readonly findAll: Effect.Effect<readonly AgentEntity[]>;
    readonly findById: (agentId: AgentIdValueObject) => Effect.Effect<AgentEntity, AgentNotFoundError>;
  }
>()("aggregor-app/domain/entities/agent/agent.repository.interface/IAgentRepository") {}
