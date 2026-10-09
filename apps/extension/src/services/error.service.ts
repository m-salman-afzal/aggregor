import {VscService} from "@/services/vsc.service.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer} from "effect";

export class ErrorService extends Context.Service<
  ErrorService,
  {readonly show: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>}
>()("aggregor/services/error.service/ErrorService") {
  public static readonly layer = Layer.effect(
    ErrorService,
    Effect.gen(function* () {
      const {window} = yield* VscService;

      const show = Effect.fn("show")(function* (message: string, ...actions: string[]) {
        return yield* Effect.promise(async () => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
      });

      return ErrorService.of({show});
    })
  );
}
