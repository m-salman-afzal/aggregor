import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer} from "effect";

export class AppErrorMessage extends Context.Service<AppErrorMessage>()(
  "aggregor-app/presentation/errorMessages/app.errorMessage/AppErrorMessage",
  {
    make: Effect.fn("make")(function* () {
      const getAppCommandErrorMessage = Effect.fn("getAppCommandErrorMessage")(function* (appCommandError: never) {
        return appCommandError;
      });

      return {getAppCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("AppErrorMessage", this.make()));
}
