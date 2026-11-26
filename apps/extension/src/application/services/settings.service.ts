import {Context, Effect, Layer} from "effect";

import {SettingChangeDtoSchema} from "@/dtos/settings.dto.ts";
import {ISettingsConfig} from "@/interfaces/settings.config.interface.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";

import type {UpdateSettingRequestDto} from "@/dtos/settings.dto.ts";

export class SettingsService extends Context.Service<SettingsService>()(
  "aggregor-app/application/services/settings.service/SettingsService",
  {
    make: Effect.fn("SettingsService.make")(function* () {
      const settingsConfig = yield* ISettingsConfig;

      const updateSetting = Effect.fn("SettingsService.updateSetting")(function* (request: UpdateSettingRequestDto) {
        const previousValue = yield* settingsConfig.saveUserSetting(SETTINGS_SECTION, request.setting, request.value);

        return SettingChangeDtoSchema.make({
          newValue: request.value,
          previousValue,
          settingId: `${SETTINGS_SECTION}.${request.setting}`
        });
      });

      const getSettings = Effect.fn("SettingsService.getSettings")(function* () {
        return yield* settingsConfig.readAggregorSettings;
      });

      return {getSettings: getSettings(), updateSetting};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
