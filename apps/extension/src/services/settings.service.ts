import {InvalidSettings} from "@/errors/settings.error.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Schema} from "effect";

const Settings = Schema.Struct({
  autoCommit: Schema.Boolean,
  commitCommand: Schema.NonEmptyString
});

export class SettingsService extends Context.Service<
  SettingsService,
  {readonly readSettings: Effect.Effect<typeof Settings.Type, InvalidSettings>}
>()("aggregor/services/settings.service/SettingsService") {
  public static readonly layer = Layer.effect(
    SettingsService,
    Effect.gen(function* () {
      const {getConfiguration} = yield* VsCodeService;

      const readSettings = getConfiguration(SETTINGS_SECTION).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(Settings)),
        Effect.mapError((schemaError) => new InvalidSettings({reason: schemaError.message}))
      );

      return SettingsService.of({readSettings});
    })
  );
}
