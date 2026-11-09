import {APP_ERRORS} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireDisposable, showErrorInBackground} from "@pkg/vscode/src/vscode.utils.ts";
import {Effect} from "effect";

import type {InvalidVsCodeArgumentError} from "@pkg/vscode/src/vsCodeArgument.utils.ts";

// A failure the use case returned: logged, and shown with the message its presenter gives.
const showCommandError = Effect.fn("RegisterCommandMiddleware.showCommandError")(function* <CommandError>(
  commandId: string,
  commandError: CommandError,
  presentCommandError: (commandError: CommandError) => Effect.Effect<string>
) {
  yield* Effect.logError(`Command ${commandId} failed`, commandError);
  const errorMessage = yield* presentCommandError(commandError);
  yield* showErrorInBackground(errorMessage);
});

// Registered for the surrounding scope's lifetime. Each run is a root span named by the command ID. The presenter must
// cover every failure the controller returns; arguments that do not decode point at a broken menu entry; a crash is
// logged.
export const registerCommand = Effect.fn("RegisterCommandMiddleware.registerCommand")(function* <
  CommandError extends {readonly _tag: string},
  R
>(
  commandId: string,
  controller: (
    ...commandArguments: readonly unknown[]
  ) => Effect.Effect<unknown, InvalidVsCodeArgumentError | NoInfer<CommandError>, R>,
  presentCommandError: (commandError: CommandError) => Effect.Effect<string>
) {
  const {commands} = yield* VsCodeApi;
  const commandContext = yield* Effect.context<R | VsCodeApi>();
  const runPromise = Effect.runPromiseWith(commandContext);
  // eslint-disable-next-line aggregor/span-name -- a command's root span is named by its command ID
  const runCommand = Effect.fn(commandId, {root: true})(
    function* (commandArguments: readonly unknown[]) {
      return yield* controller(...commandArguments);
    },
    Effect.catchTag("InvalidVsCodeArgumentError", (invalidArgument) =>
      Effect.andThen(
        Effect.logError(`Command ${commandId} got unexpected arguments`, invalidArgument),
        showErrorInBackground(APP_ERRORS.INVALID_COMMAND_ARGUMENTS(commandId))
      )
    ),
    Effect.catch((commandError) => showCommandError(commandId, commandError, presentCommandError)),
    Effect.tapCause((cause) => Effect.logError(`Command ${commandId} crashed`, cause))
  );

  yield* acquireDisposable(() =>
    commands.registerCommand(commandId, (...commandArguments: unknown[]) => runPromise(runCommand(commandArguments)))
  );
});
