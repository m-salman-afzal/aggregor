import {InvalidSettings} from "@/errors/settings.error.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Schema} from "effect";

const Settings = Schema.Struct({
  autoCommit: Schema.Boolean,
  commitCommand: Schema.NonEmptyString
});

const makeSettingsService = Effect.fn("SettingsService.make")(function* () {
  const {getConfiguration} = yield* VsCodeService;

  const readSettings = Effect.fn("SettingsService.readSettings")(
    function* () {
      const configuredSettings = yield* getConfiguration(SETTINGS_SECTION);

      return yield* Schema.decodeUnknownEffect(Settings)(configuredSettings);
    },
    Effect.mapError((schemaError) => new InvalidSettings({reason: schemaError.message}))
  );

  return {readSettings};
});

export class SettingsService extends Context.Service<
  SettingsService,
  {readonly readSettings: () => Effect.Effect<typeof Settings.Type, InvalidSettings>}
>()("aggregor/services/settings.service/SettingsService") {
  public static readonly layer = Layer.effect(SettingsService, makeSettingsService());
}
