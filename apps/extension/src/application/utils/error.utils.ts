import {IPromptInfraService} from "@/application/interfaces/prompt/prompt.infraService.interface.ts";
import {Effect} from "effect";

// Shows the message without waiting for the user to dismiss it, so whatever failed can finish now.
export const showErrorInBackground = Effect.fn("showErrorInBackground")(function* (message: string) {
  yield* Effect.forkDetach(
    IPromptInfraService.use((promptInfraService) => promptInfraService.showErrorMessage(message))
  );
});
