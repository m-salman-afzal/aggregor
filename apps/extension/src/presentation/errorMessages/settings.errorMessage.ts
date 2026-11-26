import {Context, Effect, Layer, Match} from "effect";

import {SETTINGS_ERRORS} from "@pkg/constants/src/settings.constant.ts";

import type {SettingsService} from "@/services/settings.service.ts";

type SettingsCommandError = Effect.Error<ReturnType<SettingsService["Service"]["updateSetting"]>>;

export class SettingsErrorMessage extends Context.Service<SettingsErrorMessage>()(
  "aggregor-app/presentation/errorMessages/settings.errorMessage/SettingsErrorMessage",
  {
    make: Effect.fn("SettingsErrorMessage.make")(function* () {
      const getSettingsCommandErrorMessage = Effect.fn("SettingsErrorMessage.getSettingsCommandErrorMessage")(
        function* (settingsCommandError: SettingsCommandError) {
          return Match.valueTags(settingsCommandError, {
            SettingSaveFailedError: (error) => ({
              message: SETTINGS_ERRORS.SAVE_FAILED(error.settingsSection, error.settingKey)
            })
          });
        }
      );

      return {getSettingsCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
