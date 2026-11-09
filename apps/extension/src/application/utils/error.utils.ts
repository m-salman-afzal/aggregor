import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {Effect} from "effect";

// Shows the message without waiting for the user to dismiss it, so whatever failed can finish now.
export const showErrorInBackground = Effect.fn("showErrorInBackground")(function* (message: string) {
  yield* Effect.forkDetach(
    IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.showErrorMessage(message)
    )
  );
});
