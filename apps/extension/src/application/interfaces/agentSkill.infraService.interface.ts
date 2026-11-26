import {Context} from "effect";

import type {Effect} from "effect";

export class IAgentSkillInfraService extends Context.Service<
  IAgentSkillInfraService,
  {
    // A file it can't write is logged and skipped.
    readonly writeAgentSkill: (skillText: string) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/agentSkill.infraService.interface/IAgentSkillInfraService") {}
