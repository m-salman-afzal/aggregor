import {AppErrorMessage} from "@errorMessages/app.errorMessage.ts";
import {RegisterCommandMiddleware} from "@middlewares/registerCommand.middleware.ts";
import {APP_COMMANDS} from "@pkg/constants/src/app.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {Context, Effect, Layer} from "effect";

export class AppController extends Context.Service<AppController>()(
  "aggregor-app/presentation/controllers/app.controller/AppController",
  {
    make: Effect.fn("make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const appErrorMessage = yield* AppErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const openAggregorSettings = Effect.fn("openAggregorSettings")(function* () {
        yield* vscodeUtils.openAggregorSettingsInSettingsEditor;
      });

      yield* registerCommandMiddleware.registerCommand(
        APP_COMMANDS.OPEN_SETTINGS,
        openAggregorSettings,
        appErrorMessage.getAppCommandErrorMessage
      );

      return {openAggregorSettings: openAggregorSettings()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("AppController", this.make())).pipe(
    Layer.provide([AppErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
