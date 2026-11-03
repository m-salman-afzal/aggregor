import {SettingsClient} from "@/application/clients/settings.client.ts";
import {InvalidSettings} from "@/application/errors/settings.error.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer, Schema} from "effect";

const SettingsSchema = Schema.Struct({
  autoCommit: Schema.Boolean,
  commitCommand: Schema.NonEmptyString
});

const readSettings = Effect.fn("SettingsClient.readSettings")(
  function* (getConfig: VsCodeService["Service"]["getConfiguration"]) {
    const configuredSettings = yield* getConfig(SETTINGS_SECTION);

    return yield* Schema.decodeUnknownEffect(SettingsSchema)(configuredSettings);
  },
  Effect.mapError((schemaError) => new InvalidSettings({reason: schemaError.message}))
);

const makeSettingsClientOnVsCode = Effect.fn("SettingsClient.make")(function* () {
  const {getConfiguration} = yield* VsCodeService;

  return {readSettings: () => readSettings(getConfiguration)};
});

export const SettingsClientOnVsCode = Layer.effect(SettingsClient, makeSettingsClientOnVsCode());
