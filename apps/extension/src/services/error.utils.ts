import {ErrorService} from "@/services/error.service.ts";
import {Effect} from "effect";

// Shows the message without waiting for the user to dismiss it, so whatever failed can finish now.
export const showErrorInBackground = (message: string) =>
  Effect.forkDetach(ErrorService.use((errorService) => errorService.showErrorMessage(message))).pipe(Effect.asVoid);
