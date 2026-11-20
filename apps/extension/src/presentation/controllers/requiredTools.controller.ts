import {RequiredToolsErrorMessage} from "@errorMessages/requiredTools.errorMessage.ts";
import {RegisterCommandMiddleware} from "@middlewares/registerCommand.middleware.ts";
import {REQUIRED_TOOLS_COMMANDS} from "@pkg/constants/src/requiredTools.constant.ts";
import {RequiredToolsService} from "@services/requiredTools.service.ts";
import {Context, Effect, Layer} from "effect";

export class RequiredToolsController extends Context.Service<RequiredToolsController>()(
  "aggregor-app/presentation/controllers/requiredTools.controller/RequiredToolsController",
  {
    make: Effect.fn("RequiredToolsController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const requiredToolsService = yield* RequiredToolsService;
      const requiredToolsErrorMessage = yield* RequiredToolsErrorMessage;

      const installRequiredToolsFromNotice = Effect.fn("RequiredToolsController.installRequiredToolsFromNotice")(
        function* () {
          yield* requiredToolsService.installRequiredTools;
        }
      );

      const watchMissingToolsForRequiredToolsNoticesView = Effect.fn(
        "RequiredToolsController.watchMissingToolsForRequiredToolsNoticesView"
      )(function* () {
        return yield* requiredToolsService.watchMissingTools;
      });

      yield* registerCommandMiddleware.registerCommand(
        REQUIRED_TOOLS_COMMANDS.INSTALL,
        installRequiredToolsFromNotice,
        requiredToolsErrorMessage.getRequiredToolsCommandErrorMessage
      );

      return {
        installRequiredToolsFromNotice: installRequiredToolsFromNotice(),
        watchMissingToolsForRequiredToolsNoticesView: watchMissingToolsForRequiredToolsNoticesView()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([RequiredToolsErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
