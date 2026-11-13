import {AgentEntity} from "@entities/agent/agent.entity.ts";
import {AgentNotFoundError, IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {AGENT_ICON, AGENT_SETTINGS, AGENTS_SETTING_ID} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {EnvironmentVariablesValueObjectSchema} from "@valueObjects/environmentVariables.valueObject.ts";
import {Array, Effect, Layer, Predicate, Record, Ref, Result, Schema, Stream} from "effect";
import {Path} from "effect/Path";

import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";

// What the agents need from VS Code and the machine: the settings, and the extension's folder for relative icons.
interface AgentSettingsSource {
  readonly extensionPath: string;
  readonly getConfiguration: VsCodeApi["Service"]["getConfiguration"];
  readonly path: Path;
  readonly workspace: VsCodeApi["Service"]["workspace"];
}

// One aggregorApp.agents entry as the user may write it: the command defaults to its key, the name too, resumeArgs
// to args, and the icon to Aggregor's logo.
const AgentSettingSchema = Schema.Struct({
  args: Schema.optional(Schema.Array(Schema.String)),
  command: Schema.optional(Schema.NonEmptyString),
  env: Schema.optional(EnvironmentVariablesValueObjectSchema),
  icon: Schema.optional(Schema.String.check(Schema.isPattern(AGENT_ICON.FILE_PATTERN))),
  name: Schema.optional(Schema.NonEmptyString),
  resumeArgs: Schema.optional(Schema.Array(Schema.String))
});

// A relative icon is inside the extension's folder.
const toAgentIcon = Effect.fn("AgentRepository.toAgentIcon")(function* (
  agentSettingsSource: AgentSettingsSource,
  icon: string | undefined
) {
  const iconPath = icon === undefined ? AGENT_ICON.DEFAULT : icon;

  return agentSettingsSource.path.isAbsolute(iconPath)
    ? iconPath
    : agentSettingsSource.path.join(agentSettingsSource.extensionPath, iconPath);
});

const toAgent = Effect.fn("AgentRepository.toAgent")(
  function* (agentSettingsSource: AgentSettingsSource, [agentKey, agentSetting]: readonly [string, unknown]) {
    const agentSettingFields = yield* Schema.decodeUnknownEffect(AgentSettingSchema)(agentSetting);
    const agentArguments = agentSettingFields.args === undefined ? [] : agentSettingFields.args;
    const agentIcon = yield* toAgentIcon(agentSettingsSource, agentSettingFields.icon);

    return yield* Schema.decodeEffect(AgentEntity)({
      args: agentArguments,
      command: agentSettingFields.command === undefined ? agentKey : agentSettingFields.command,
      environmentVariables: agentSettingFields.env === undefined ? {} : agentSettingFields.env,
      icon: agentIcon,
      id: agentKey,
      name: agentSettingFields.name === undefined ? agentKey : agentSettingFields.name,
      resumeArgs: agentSettingFields.resumeArgs === undefined ? agentArguments : agentSettingFields.resumeArgs
    });
  },
  (effect, _agentSettingsSource, [agentKey]) =>
    Effect.tapError(effect, (invalidSetting) =>
      Effect.logWarning(`The aggregorApp.agents entry "${agentKey}" is invalid and left out`, invalidSetting)
    )
);

// The built-ins are the setting's default, which VS Code merges with the user's entries key by key; null hides an entry,
// and one that doesn't decode is left out with a warning.
const readAgents = Effect.fn("AgentRepository.readAgents")(function* (agentSettingsSource: AgentSettingsSource) {
  const config = yield* agentSettingsSource.getConfiguration(SETTINGS_SECTION);
  const agentSettings: unknown = config.get(AGENT_SETTINGS.AGENTS);
  const agentEntries = Predicate.isObject(agentSettings) ? Record.toEntries(agentSettings) : [];
  const shownAgentEntries = Array.filter(agentEntries, ([, agentSetting]) => agentSetting !== null);
  const agentResults = yield* Effect.forEach(shownAgentEntries, (agentEntry) =>
    Effect.result(toAgent(agentSettingsSource, agentEntry))
  );

  return Array.getSuccesses(agentResults);
});

// Read once and again on each change of the setting, so an invalid entry is warned about once, not on every read.
const watchAgentSettings = Effect.fn("AgentRepository.watchAgentSettings")(function* (
  agentSettingsSource: AgentSettingsSource,
  agents: Ref.Ref<readonly AgentEntity[]>
) {
  const settingsChanges = yield* streamVsCodeEvent(agentSettingsSource.workspace.onDidChangeConfiguration);
  const agentSettingChanges = Stream.filter(settingsChanges, (settingsChange) =>
    settingsChange.affectsConfiguration(AGENTS_SETTING_ID)
  );

  yield* Stream.runForEach(agentSettingChanges, () =>
    Effect.flatMap(readAgents(agentSettingsSource), (changedAgents) => Ref.set(agents, changedAgents))
  );
});

const findAgentById = Effect.fn("AgentRepository.findAgentById")(function* (
  agents: Ref.Ref<readonly AgentEntity[]>,
  agentId: AgentIdValueObject
) {
  const currentAgents = yield* Ref.get(agents);

  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(currentAgents, (agent) => agent.id === agentId),
      () => AgentNotFoundError.make({agentId})
    )
  );
});

const makeAgentRepository = Effect.fn("AgentRepository.make")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const agentSettingsSource: AgentSettingsSource = {
    extensionPath: vsCodeApi.extensionUri.fsPath,
    getConfiguration: vsCodeApi.getConfiguration,
    path: yield* Path,
    workspace: vsCodeApi.workspace
  };
  const initialAgents = yield* readAgents(agentSettingsSource);
  const agents = yield* Ref.make<readonly AgentEntity[]>(initialAgents);
  yield* Effect.forkScoped(watchAgentSettings(agentSettingsSource, agents));

  return {
    findAll: Ref.get(agents),
    findById: (agentId: AgentIdValueObject) => findAgentById(agents, agentId)
  };
});

export const AgentRepository = Layer.effect(IAgentRepository, makeAgentRepository());
