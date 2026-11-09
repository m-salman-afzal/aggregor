import {APP_ERRORS} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, showErrorNotificationWithoutWaiting} from "@pkg/vscode/src/vscode.utils.ts";
import {Effect} from "effect";

import type {InvalidVsCodeArgumentError} from "@pkg/vscode/src/vsCodeArgument.utils.ts";

// What a presenter makes of a failure: the message, and the setting or web page that fixes it, when one does.
interface PresentedCommandError {
  readonly message: string;
  readonly pageToOpen?: {readonly label: string; readonly url: string};
  readonly settingToOpen?: string;
}

// A failure the use case returned: logged, and shown with the message its presenter gives.
const showCommandError = Effect.fn("RegisterCommandMiddleware.showCommandError")(function* <CommandError>(
  commandId: string,
  commandError: CommandError,
  presentCommandError: (commandError: CommandError) => Effect.Effect<PresentedCommandError>
) {
  yield* Effect.logError(`Command ${commandId} failed`, commandError);
  const {message, pageToOpen, settingToOpen} = yield* presentCommandError(commandError);
  yield* showErrorNotificationWithoutWaiting(message, {pageToOpen, settingToOpen});
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
  presentCommandError: (commandError: CommandError) => Effect.Effect<PresentedCommandError>
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
        showErrorNotificationWithoutWaiting(APP_ERRORS.INVALID_COMMAND_ARGUMENTS(commandId))
      )
    ),
    Effect.catch((commandError) => showCommandError(commandId, commandError, presentCommandError)),
    Effect.tapCause((cause) => Effect.logError(`Command ${commandId} crashed`, cause))
  );

  yield* acquireScopedDisposable(() =>
    commands.registerCommand(commandId, (...commandArguments: unknown[]) => runPromise(runCommand(commandArguments)))
  );
});
