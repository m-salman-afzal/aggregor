import {InvalidSettingsError, ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";
import {Effect, Layer, Schema} from "effect";

import type {AlertSettings, SessionSettings} from "@interfaces/settings.config.interface.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";

// What saving the default needs from VS Code.
type SettingsDependencies = Pick<VsCodeApi["Service"], "ConfigurationTarget" | "getConfiguration">;

class DefaultAgentSaveFailedError extends Schema.TaggedError<
  DefaultAgentSaveFailedError,
  {readonly brand: unique symbol}
>()("DefaultAgentSaveFailedError", {cause: Schema.Unknown}) {}

const SettingsSchema = Schema.Struct({
  autoCommit: Schema.Boolean,
  commitCommand: Schema.NonEmptyString
});

const SessionSettingsSchema = Schema.Struct({
  defaultAgent: AgentIdValueObjectSchema,
  skipAgentPicker: Schema.Boolean
});

const AlertSettingsSchema = Schema.Struct({
  notifyOn: Schema.Array(AgentStatusValueObjectSchema)
});

const readSettings = Effect.fn("SettingsConfig.readSettings")(
  function* ({getConfiguration}: SettingsDependencies) {
    const configuredSettings = yield* getConfiguration(SETTINGS_SECTION);

    return yield* Schema.decodeUnknownEffect(SettingsSchema)(configuredSettings);
  },
  Effect.mapError((schemaError) => InvalidSettingsError.make({reason: schemaError.message}))
);

const readSessionSettings = Effect.fn("SettingsConfig.readSessionSettings")(
  function* ({getConfiguration}: SettingsDependencies) {
    const configuredSettings = yield* getConfiguration(SETTINGS_SECTION);
    const {defaultAgent, skipAgentPicker} =
      yield* Schema.decodeUnknownEffect(SessionSettingsSchema)(configuredSettings);
    const sessionSettings: SessionSettings = {defaultAgentId: defaultAgent, skipAgentPicker};

    return sessionSettings;
  },
  Effect.mapError((schemaError) => InvalidSettingsError.make({reason: schemaError.message}))
);

const readAlertSettings = Effect.fn("SettingsConfig.readAlertSettings")(
  function* ({getConfiguration}: SettingsDependencies) {
    const configuredSettings = yield* getConfiguration(SETTINGS_SECTION);
    const {notifyOn} = yield* Schema.decodeUnknownEffect(AlertSettingsSchema)(configuredSettings);
    const alertSettings: AlertSettings = {notifyOnStatuses: notifyOn};

    return alertSettings;
  },
  Effect.mapError((schemaError) => InvalidSettingsError.make({reason: schemaError.message}))
);

// A failed write only costs the reorder, so it is logged.
const saveDefaultAgentId = Effect.fn("SettingsConfig.saveDefaultAgentId")(
  function* ({ConfigurationTarget, getConfiguration}: SettingsDependencies, agentId: AgentIdValueObject) {
    const config = yield* getConfiguration(SETTINGS_SECTION);

    yield* Effect.tryPromise({
      catch: (cause) => DefaultAgentSaveFailedError.make({cause}),
      try: () => config.update(AGENT_SETTINGS.DEFAULT_AGENT, agentId, ConfigurationTarget.Global)
    });
  },
  Effect.catch((writeError) => Effect.logWarning("Could not save the default agent", writeError))
);

const makeSettingsConfig = Effect.fn("SettingsConfig.make")(function* () {
  const {ConfigurationTarget, getConfiguration} = yield* VsCodeApi;
  const settingsDependencies: SettingsDependencies = {ConfigurationTarget, getConfiguration};

  return {
    readAlertSettings: readAlertSettings(settingsDependencies),
    readSessionSettings: readSessionSettings(settingsDependencies),
    readSettings: readSettings(settingsDependencies),
    saveDefaultAgentId: (agentId: AgentIdValueObject) => saveDefaultAgentId(settingsDependencies, agentId)
  };
});

export const SettingsConfig = Layer.effect(ISettingsConfig, makeSettingsConfig());
