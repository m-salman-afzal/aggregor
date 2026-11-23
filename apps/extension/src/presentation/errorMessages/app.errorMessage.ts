import {Context, Effect, Layer} from "effect";

export class AppErrorMessage extends Context.Service<AppErrorMessage>()(
  "aggregor-app/presentation/errorMessages/app.errorMessage/AppErrorMessage",
  {
    make: Effect.fn("AppErrorMessage.make")(function* () {
      const getAppCommandErrorMessage = Effect.fn("AppErrorMessage.getAppCommandErrorMessage")(function* (
        appCommandError: never
      ) {
        return appCommandError;
      });

      return {getAppCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
