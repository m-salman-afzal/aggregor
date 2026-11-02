import {VsCodeService} from "@/services/vscode.service.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer} from "effect";

const makeErrorService = Effect.fn("ErrorService.make")(function* () {
  const {window} = yield* VsCodeService;

  const showErrorMessage = Effect.fn("ErrorService.showErrorMessage")(function* (
    message: string,
    ...actions: string[]
  ) {
    return yield* Effect.promise(async () => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
  });

  return {showErrorMessage};
});

export class ErrorService extends Context.Service<
  ErrorService,
  {readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>}
>()("aggregor/services/error.service/ErrorService") {
  public static readonly layer = Layer.effect(ErrorService, makeErrorService());
}
