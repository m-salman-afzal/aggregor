import {Context, Effect, Layer} from "effect";

import {IAgentSkillInfraService} from "@/interfaces/agentSkill.infraService.interface.ts";
import {AGENT_SKILL} from "@pkg/constants/src/agentApi.constant.ts";

export class AgentSkillService extends Context.Service<AgentSkillService>()(
  "aggregor-app/application/services/agentSkill.service/AgentSkillService",
  {
    make: Effect.fn("AgentSkillService.make")(function* () {
      const agentSkillInfraService = yield* IAgentSkillInfraService;

      const installAgentSkill = Effect.fn("AgentSkillService.installAgentSkill")(function* () {
        yield* agentSkillInfraService.writeAgentSkill(AGENT_SKILL.TEXT);
      });

      return {installAgentSkill: installAgentSkill()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
