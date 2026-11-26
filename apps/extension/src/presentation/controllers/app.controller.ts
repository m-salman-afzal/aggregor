import {Context, Effect, Layer} from "effect";

import {AppErrorMessage} from "@/errorMessages/app.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {APP_COMMANDS} from "@pkg/constants/src/app.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

export class AppController extends Context.Service<AppController>()(
  "aggregor-app/presentation/controllers/app.controller/AppController",
  {
    make: Effect.fn("AppController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const appErrorMessage = yield* AppErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const openAggregorSettings = Effect.fn("AppController.openAggregorSettings")(function* () {
        yield* vscodeUtils.openAggregorSettingsInSettingsEditor;
      });

      yield* registerCommandMiddleware.registerCommandWithoutRequest({
        commandId: APP_COMMANDS.OPEN_SETTINGS,
        controller: openAggregorSettings,
        getCommandErrorMessage: appErrorMessage.getAppCommandErrorMessage
      });

      return {openAggregorSettings: openAggregorSettings()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([AppErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
