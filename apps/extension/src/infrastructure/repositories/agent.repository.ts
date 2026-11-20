import {NodeServices} from "@effect/platform-node";
import {AgentEntity} from "@entities/agent/agent.entity.ts";
import {IAgentRepository, IAgentRepositoryErrors} from "@entities/agent/agent.repository.interface.ts";
import {AGENT_ICON, AGENT_SETTINGS, AGENTS_SETTING_ID} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {EnvironmentVariablesValueObjectSchema} from "@valueObjects/environmentVariables.valueObject.ts";
import {Array, Context, Effect, Layer, Predicate, Record, Ref, Result, Schema, Stream} from "effect";
import {Path} from "effect/Path";

import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";

const AgentSettingSchema = Schema.Struct({
  args: Schema.optional(Schema.Array(Schema.String)),
  command: Schema.optional(Schema.NonEmptyString),
  env: Schema.optional(EnvironmentVariablesValueObjectSchema),
  icon: Schema.optional(Schema.String.check(Schema.isPattern(AGENT_ICON.FILE_PATTERN))),
  name: Schema.optional(Schema.NonEmptyString),
  resumeArgs: Schema.optional(Schema.Array(Schema.String))
});

export class AgentRepository extends Context.Service<AgentRepository>()(
  "aggregor-app/infrastructure/repositories/agent.repository/AgentRepository",
  {
    make: Effect.fn("make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const path = yield* Path;

      const resolveAgentIconPath = Effect.fn("resolveAgentIconPath")(function* (icon: string | undefined) {
        const iconPath = icon === undefined ? AGENT_ICON.DEFAULT : icon;

        return path.isAbsolute(iconPath) ? iconPath : path.join(vsCodeApi.extensionUri.fsPath, iconPath);
      });

      const decodeAgentFromSettingEntry = Effect.fn("decodeAgentFromSettingEntry")(
        function* ([agentKey, agentSetting]: readonly [string, unknown]) {
          const agentSettingFields = yield* Schema.decodeUnknownEffect(AgentSettingSchema)(agentSetting);
          const agentArguments = agentSettingFields.args === undefined ? [] : agentSettingFields.args;
          const agentIcon = yield* resolveAgentIconPath(agentSettingFields.icon);

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
        (effect, [agentKey]) =>
          Effect.tapError(effect, (invalidSetting) =>
            Effect.logWarning(`The aggregorApp.agents entry "${agentKey}" is invalid and left out`, invalidSetting)
          )
      );

      // VS Code merges the built-in defaults with the user's entries key by key; null hides an entry.
      const readAgents = Effect.fn("readAgents")(function* () {
        const config = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
        const agentSettings: unknown = config.get(AGENT_SETTINGS.AGENTS);
        const agentEntries = Predicate.isObject(agentSettings) ? Record.toEntries(agentSettings) : [];
        const shownAgentEntries = Array.filter(agentEntries, ([, agentSetting]) => agentSetting !== null);
        const agentResults = yield* Effect.forEach(shownAgentEntries, (agentEntry) =>
          Effect.result(decodeAgentFromSettingEntry(agentEntry))
        );

        return Array.getSuccesses(agentResults);
      });

      const initialAgents = yield* readAgents();
      const agents = yield* Ref.make<readonly AgentEntity[]>(initialAgents);

      // Read once and again on each change of the setting, so an invalid entry is warned about once, not on every read.
      const watchAgentSettings = Effect.fn("watchAgentSettings")(function* () {
        const settingsChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.workspace.onDidChangeConfiguration);
        const agentSettingChanges = Stream.filter(settingsChanges, (settingsChange) =>
          settingsChange.affectsConfiguration(AGENTS_SETTING_ID)
        );

        yield* Stream.runForEach(agentSettingChanges, () =>
          Effect.flatMap(readAgents(), (changedAgents) => Ref.set(agents, changedAgents))
        );
      });

      const findAgentById = Effect.fn("findAgentById")(function* (agentId: AgentIdValueObject) {
        const currentAgents = yield* Ref.get(agents);

        return yield* Effect.fromResult(
          Result.fromOption(
            Array.findFirst(currentAgents, (agent) => agent.id === agentId),
            () => IAgentRepositoryErrors.AgentNotFoundError.make({agentId})
          )
        );
      });

      yield* Effect.forkScoped(watchAgentSettings());

      return {
        findAll: Ref.get(agents),
        findById: findAgentById
      };
    })
  }
) {
  public static readonly layer = Layer.effect(IAgentRepository, ownSpans("AgentRepository", this.make())).pipe(
    Layer.provide(NodeServices.layer)
  );
}
