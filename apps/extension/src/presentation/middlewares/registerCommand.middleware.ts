import {APP_ERRORS} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, showErrorNotificationWithoutWaiting} from "@pkg/vscode/src/vscode.utils.ts";
import {Effect} from "effect";

import type {InvalidVsCodeArgumentError} from "@pkg/vscode/src/vsCodeArgument.utils.ts";

interface PresentedCommandError {
  readonly message: string;
  readonly pageToOpen?: {readonly label: string; readonly url: string};
  readonly settingToOpen?: string;
}

const showCommandError = Effect.fn("RegisterCommandMiddleware.showCommandError")(function* <CommandError>(
  commandId: string,
  commandError: CommandError,
  presentCommandError: (commandError: CommandError) => Effect.Effect<PresentedCommandError>
) {
  yield* Effect.logError(`Command ${commandId} failed`, commandError);
  const presentedCommandError = yield* presentCommandError(commandError);
  yield* showErrorNotificationWithoutWaiting(presentedCommandError.message, presentedCommandError);
});

// Arguments that do not decode point at a broken menu entry.
const showInvalidArguments = Effect.fn("RegisterCommandMiddleware.showInvalidArguments")(function* (
  commandId: string,
  invalidArgument: unknown
) {
  yield* Effect.logError(`Command ${commandId} got unexpected arguments`, invalidArgument);
  yield* showErrorNotificationWithoutWaiting(APP_ERRORS.INVALID_COMMAND_ARGUMENTS(commandId));
});

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
  const vsCodeApi = yield* VsCodeApi;
  const commandContext = yield* Effect.context<R | VsCodeApi>();
  const runPromise = Effect.runPromiseWith(commandContext);
  // eslint-disable-next-line aggregor/span-name -- a command's root span is named by its command ID
  const runCommand = Effect.fn(commandId, {root: true})(
    function* (commandArguments: readonly unknown[]) {
      return yield* controller(...commandArguments);
    },
    Effect.catchTag("InvalidVsCodeArgumentError", (invalidArgument) =>
      showInvalidArguments(commandId, invalidArgument)
    ),
    Effect.catch((commandError) => showCommandError(commandId, commandError, presentCommandError)),
    Effect.tapCause((cause) => Effect.logError(`Command ${commandId} crashed`, cause))
  );

  yield* acquireScopedDisposable(() =>
    vsCodeApi.commands.registerCommand(commandId, (...commandArguments: unknown[]) =>
      runPromise(runCommand(commandArguments))
    )
  );
});
