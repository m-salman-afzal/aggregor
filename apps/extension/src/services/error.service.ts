import {VsCodeService} from "@/services/vscode.service.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer} from "effect";

export class ErrorService extends Context.Service<
  ErrorService,
  {readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>}
>()("aggregor/services/error.service/ErrorService") {
  public static readonly layer = Layer.effect(
    ErrorService,
    Effect.gen(function* () {
      const {window} = yield* VsCodeService;

      const showErrorMessage = Effect.fn("ErrorService.showErrorMessage")(function* (
        message: string,
        ...actions: string[]
      ) {
        return yield* Effect.promise(async () => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
      });

      return ErrorService.of({showErrorMessage});
    })
  );
}
