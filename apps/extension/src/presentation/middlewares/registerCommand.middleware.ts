import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {acquireDisposable} from "@infraUtils/vscode.utils.ts";
import {COMMAND_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Schema} from "effect";

import type {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";

// What VS Code passed a command is not what its menu entry sends.
export class InvalidCommandArgumentsError extends Schema.TaggedError<
  InvalidCommandArgumentsError,
  {readonly brand: unique symbol}
>()("InvalidCommandArgumentsError", {cause: Schema.Unknown}) {}

// Registered for the surrounding scope's lifetime. Each run is a root span named by the command ID, and a crash is
// logged. Controllers handle their own errors except arguments that do not decode, which point at a broken menu entry:
// those are logged and shown.
export const registerCommand = Effect.fn("RegisterCommandMiddleware.registerCommand")(function* <R>(
  commandId: string,
  controller: (...commandArguments: readonly unknown[]) => Effect.Effect<unknown, InvalidCommandArgumentsError, R>
) {
  const {commands} = yield* VsCodeApi;
  const commandContext = yield* Effect.context<IUserInputPromptInfraService | R>();
  const runPromise = Effect.runPromiseWith(commandContext);
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
    commands.registerCommand(commandId, (...commandArguments: unknown[]) => runPromise(runCommand(commandArguments)))
  );
});
