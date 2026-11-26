import {Context, Effect, Layer} from "effect";

import {UpdateSettingRequestDtoSchema} from "@/dtos/settings.dto.ts";
import {SettingsErrorMessage} from "@/errorMessages/settings.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {SettingsService} from "@/services/settings.service.ts";
import {SETTINGS_COMMANDS} from "@pkg/constants/src/settings.constant.ts";

import type {UpdateSettingRequestDto} from "@/dtos/settings.dto.ts";

export class SettingsController extends Context.Service<SettingsController>()(
  "aggregor-app/presentation/controllers/settings.controller/SettingsController",
  {
    make: Effect.fn("SettingsController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const settingsService = yield* SettingsService;
      const settingsErrorMessage = yield* SettingsErrorMessage;

      const updateChosenSetting = Effect.fn("SettingsController.updateChosenSetting")(function* (
        request: UpdateSettingRequestDto
      ) {
        return yield* settingsService.updateSetting(request);
      });

      const getSettingsForAgentApi = Effect.fn("SettingsController.getSettingsForAgentApi")(function* () {
        return yield* settingsService.getSettings;
      });

      yield* registerCommandMiddleware.registerCommand({
        commandId: SETTINGS_COMMANDS.UPDATE_SETTING,
        controller: updateChosenSetting,
        getCommandErrorMessage: settingsErrorMessage.getSettingsCommandErrorMessage,
        requestSchema: UpdateSettingRequestDtoSchema
      });

      return {
        getSettingsForAgentApi: getSettingsForAgentApi(),
        updateChosenSetting
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([SettingsErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
