import {Effect} from "effect";

// The app's own commands, such as Open Settings, only drive VS Code, so they have no failure to present.
export const presentAppCommandError = Effect.fn("AppPresenter.presentAppCommandError")(function* (
  appCommandError: never
) {
  return appCommandError;
});
