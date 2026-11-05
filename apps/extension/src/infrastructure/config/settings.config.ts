import {InvalidSettingsError, ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/extension.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Layer, Schema} from "effect";

const SettingsSchema = Schema.Struct({
  autoCommit: Schema.Boolean,
  commitCommand: Schema.NonEmptyString
});

const readSettings = Effect.fn("SettingsConfig.readSettings")(
  function* (getConfig: VsCodeApi["Service"]["getConfiguration"]) {
    const configuredSettings = yield* getConfig(SETTINGS_SECTION);

    return yield* Schema.decodeUnknownEffect(SettingsSchema)(configuredSettings);
  },
  Effect.mapError((schemaError) => new InvalidSettingsError({reason: schemaError.message}))
);

const makeSettingsConfig = Effect.fn("SettingsConfig.make")(function* () {
  const {getConfiguration} = yield* VsCodeApi;

  return {readSettings: () => readSettings(getConfiguration)};
});

export const SettingsConfig = Layer.effect(ISettingsConfig, makeSettingsConfig());
