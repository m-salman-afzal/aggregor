import {InvalidSettingsError, ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {HARNESS_SETTINGS} from "@pkg/constants/src/harness.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {Effect, Layer, Schema} from "effect";

import type {SessionSettings} from "@interfaces/settings.config.interface.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";

// What saving the default needs from VS Code.
type SettingsDependencies = Pick<VsCodeApi["Service"], "ConfigurationTarget" | "getConfiguration">;

class DefaultHarnessSaveFailedError extends Schema.TaggedError<
  DefaultHarnessSaveFailedError,
  {readonly brand: unique symbol}
>()("DefaultHarnessSaveFailedError", {cause: Schema.Unknown}) {}

const SettingsSchema = Schema.Struct({
  autoCommit: Schema.Boolean,
  commitCommand: Schema.NonEmptyString
});

const SessionSettingsSchema = Schema.Struct({
  defaultHarness: HarnessIdValueObjectSchema,
  skipHarnessPicker: Schema.Boolean
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
    const {defaultHarness, skipHarnessPicker} =
      yield* Schema.decodeUnknownEffect(SessionSettingsSchema)(configuredSettings);
    const sessionSettings: SessionSettings = {defaultHarnessId: defaultHarness, skipHarnessPicker};

    return sessionSettings;
  },
  Effect.mapError((schemaError) => InvalidSettingsError.make({reason: schemaError.message}))
);

// A failed write only costs the reorder, so it is logged.
const saveDefaultHarnessId = Effect.fn("SettingsConfig.saveDefaultHarnessId")(
  function* ({ConfigurationTarget, getConfiguration}: SettingsDependencies, harnessId: HarnessIdValueObject) {
    const config = yield* getConfiguration(SETTINGS_SECTION);

    yield* Effect.tryPromise({
      catch: (cause) => DefaultHarnessSaveFailedError.make({cause}),
      try: () => config.update(HARNESS_SETTINGS.DEFAULT_HARNESS, harnessId, ConfigurationTarget.Global)
    });
  },
  Effect.catch((writeError) => Effect.logWarning("Could not save the default harness", writeError))
);

const makeSettingsConfig = Effect.fn("SettingsConfig.make")(function* () {
  const {ConfigurationTarget, getConfiguration} = yield* VsCodeApi;
  const settingsDependencies: SettingsDependencies = {ConfigurationTarget, getConfiguration};

  return {
    readSessionSettings: readSessionSettings(settingsDependencies),
    readSettings: readSettings(settingsDependencies),
    saveDefaultHarnessId: (harnessId: HarnessIdValueObject) => saveDefaultHarnessId(settingsDependencies, harnessId)
  };
});

export const SettingsConfig = Layer.effect(ISettingsConfig, makeSettingsConfig());
