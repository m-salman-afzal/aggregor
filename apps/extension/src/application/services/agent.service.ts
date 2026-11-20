import {AgentListItemDtoSchema} from "@dtos/agent.dto.ts";
import {IAgentRepository, IAgentRepositoryErrors} from "@entities/agent/agent.repository.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Context, Effect, Layer, Result, Schema} from "effect";

import type {SetDefaultAgentRequestDto} from "@dtos/agent.dto.ts";
import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";

export class AgentServiceErrors extends TaggedErrors({
  NoAgentInstalledError: {searchedCommands: Schema.Array(Schema.String)}
}) {}

export class AgentService extends Context.Service<AgentService>()(
  "aggregor-app/application/services/agent.service/AgentService",
  {
    make: Effect.fn("make")(function* () {
      const agentRepository = yield* IAgentRepository;
      const settingsConfig = yield* ISettingsConfig;
      const shellCommandInfraService = yield* IShellCommandInfraService;

      const listInstalledAgents = Effect.fn("listInstalledAgents")(function* () {
        const agents = yield* agentRepository.findAll;
        const agentCommands = Array.map(agents, (agent) => agent.command);
        const installedCommands = yield* shellCommandInfraService.listInstalledCommands(agentCommands);
        const installedAgents = Array.filter(agents, (agent) => installedCommands.has(agent.command));
        if (!Array.isReadonlyArrayNonEmpty(installedAgents))
          return yield* AgentServiceErrors.NoAgentInstalledError.make({searchedCommands: agentCommands});

        return installedAgents;
      });

      const findInstalledAgent = Effect.fn("findInstalledAgent")(function* (
        installedAgents: readonly AgentEntity[],
        agentId: AgentIdValueObject
      ) {
        return yield* Effect.fromResult(
          Result.fromOption(
            Array.findFirst(installedAgents, (installedAgent) => installedAgent.id === agentId),
            () => IAgentRepositoryErrors.AgentNotFoundError.make({agentId})
          )
        );
      });

      const findAgentToStart = Effect.fn("findAgentToStart")(function* (agentId: AgentIdValueObject | undefined) {
        const installedAgents = yield* listInstalledAgents();
        if (agentId !== undefined) return yield* findInstalledAgent(installedAgents, agentId);
        const sessionSettings = yield* settingsConfig.readSessionSettings;
        const defaultAgentResult = yield* Effect.result(
          findInstalledAgent(installedAgents, sessionSettings.defaultAgentId)
        );

        return Result.getOrElse(defaultAgentResult, () => Array.headNonEmpty(installedAgents));
      });

      const listAgents = Effect.fn("listAgents")(
        function* () {
          const sessionSettings = yield* settingsConfig.readSessionSettings;
          const installedAgents = yield* listInstalledAgents();
          const agentListItems = Array.map(installedAgents, (installedAgent) =>
            AgentListItemDtoSchema.make({
              agentId: installedAgent.id,
              command: installedAgent.command,
              icon: installedAgent.icon,
              isDefault: installedAgent.id === sessionSettings.defaultAgentId,
              name: installedAgent.name
            })
          );

          return [
            ...Array.filter(agentListItems, (agentListItem) => agentListItem.isDefault),
            ...Array.filter(agentListItems, (agentListItem) => !agentListItem.isDefault)
          ];
        },
        Effect.catchTag("NoAgentInstalledError", () => Effect.succeed([]))
      );

      const setDefaultAgent = Effect.fn("setDefaultAgent")(function* (request: SetDefaultAgentRequestDto) {
        yield* settingsConfig.saveDefaultAgentId(request.agentId);
      });

      return {findAgentToStart, listAgents: listAgents(), setDefaultAgent};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("AgentService", this.make()));
}
