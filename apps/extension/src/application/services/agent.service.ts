import {AgentListItemDtoSchema} from "@dtos/agent.dto.ts";
import {AgentNotFoundError, IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {Array, Effect, Result, Schema} from "effect";

import type {SetDefaultAgentRequestDto} from "@dtos/agent.dto.ts";
import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";

export class NoAgentInstalledError extends Schema.TaggedError<NoAgentInstalledError, {readonly brand: unique symbol}>()(
  "NoAgentInstalledError",
  {searchedCommands: Schema.Array(Schema.String)}
) {}

const listInstalledAgents = Effect.fn("AgentService.listInstalledAgents")(function* () {
  const agents = yield* IAgentRepository.use((agentRepository) => agentRepository.findAll);
  const agentCommands = Array.map(agents, (agent) => agent.command);
  const installedCommands = yield* IShellCommandInfraService.use((shellCommandInfraService) =>
    shellCommandInfraService.listInstalledCommands(agentCommands)
  );
  const installedAgents = Array.filter(agents, (agent) => installedCommands.has(agent.command));
  if (!Array.isReadonlyArrayNonEmpty(installedAgents))
    return yield* NoAgentInstalledError.make({searchedCommands: agentCommands});

  return installedAgents;
});

const findInstalledAgent = Effect.fn("AgentService.findInstalledAgent")(function* (
  installedAgents: readonly AgentEntity[],
  agentId: AgentIdValueObject
) {
  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(installedAgents, (installedAgent) => installedAgent.id === agentId),
      () => AgentNotFoundError.make({agentId})
    )
  );
});

export const findAgentToStart = Effect.fn("AgentService.findAgentToStart")(function* (
  agentId: AgentIdValueObject | undefined
) {
  const installedAgents = yield* listInstalledAgents();
  if (agentId !== undefined) return yield* findInstalledAgent(installedAgents, agentId);
  const sessionSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSessionSettings);
  const defaultAgentResult = yield* Effect.result(findInstalledAgent(installedAgents, sessionSettings.defaultAgentId));

  return Result.getOrElse(defaultAgentResult, () => Array.headNonEmpty(installedAgents));
});

// The default agent first; none installed is an empty list, which New Session reports when it runs.
export const listAgents = Effect.fn("AgentService.listAgents")(
  function* () {
    const sessionSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSessionSettings);
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

export const setDefaultAgent = Effect.fn("AgentService.setDefaultAgent")(function* (
  request: SetDefaultAgentRequestDto
) {
  yield* ISettingsConfig.use((settingsConfig) => settingsConfig.saveDefaultAgentId(request.agentId));
});
