import {InvalidSettingsError} from "@/application/interfaces/settings/settings.config.error.ts";
import {ISettingsConfig} from "@/application/interfaces/settings/settings.config.interface.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/extension.constant.ts";
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
