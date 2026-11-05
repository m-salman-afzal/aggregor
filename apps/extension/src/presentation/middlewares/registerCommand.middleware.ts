import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {acquireDisposable} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {COMMAND_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Data, Effect} from "effect";

import type {IPromptInfraService} from "@/application/interfaces/prompt.infraService.interface.ts";

// What VS Code passed a command is not what its menu entry sends.
export class InvalidCommandArgumentsError extends Data.TaggedError("InvalidCommandArgumentsError")<{
  readonly cause: unknown;
}> {}

// Registered for the surrounding scope's lifetime. Each run is a root span named by the command ID, and a crash is
// logged. Controllers handle their own errors except arguments that do not decode, which point at a broken menu entry:
// those are logged and shown.
export const registerCommand = Effect.fn("RegisterCommandMiddleware.registerCommand")(function* <R>(
  commandId: string,
  controller: (...commandArguments: readonly unknown[]) => Effect.Effect<unknown, InvalidCommandArgumentsError, R>
) {
  const {commands} = yield* VsCodeApi;
  const runPromise = Effect.runPromiseWith(yield* Effect.context<IPromptInfraService | R>());
  // eslint-disable-next-line aggregor/span-name -- a command's root span is named by its command ID
  const runCommand = Effect.fn(commandId, {root: true})(
    function* (commandArguments: readonly unknown[]) {
      return yield* controller(...commandArguments);
    },
    Effect.catchTag("InvalidCommandArgumentsError", (invalidCommandArguments) =>
      Effect.andThen(
        Effect.logError(`Command ${commandId} got unexpected arguments`, invalidCommandArguments.cause),
        showErrorInBackground(COMMAND_MESSAGES.UNEXPECTED_ARGUMENTS(commandId))
      )
    ),
    Effect.tapCause((cause) => Effect.logError(`Command ${commandId} failed`, cause))
  );

  yield* acquireDisposable(() =>
    commands.registerCommand(commandId, async (...commandArguments: unknown[]) =>
      runPromise(runCommand(commandArguments))
    )
  );
});
