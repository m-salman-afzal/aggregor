import {APP_ERRORS} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {Context, Effect, Layer} from "effect";

import type {VscodeUtilsErrors} from "@pkg/vscode/src/vscode.utils.ts";

interface CommandErrorMessage {
  readonly commandToRun?: {readonly commandId: string; readonly label: string};
  readonly message: string;
  readonly pageToOpen?: {readonly label: string; readonly url: string};
  readonly settingToOpen?: string;
}

export class RegisterCommandMiddleware extends Context.Service<RegisterCommandMiddleware>()(
  "aggregor-app/presentation/middlewares/registerCommand.middleware/RegisterCommandMiddleware",
  {
    make: Effect.fn("RegisterCommandMiddleware.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;

      const showCommandError = Effect.fn("RegisterCommandMiddleware.showCommandError")(function* <CommandError>(
        commandId: string,
        commandError: CommandError,
        getCommandErrorMessage: (commandError: CommandError) => Effect.Effect<CommandErrorMessage>
      ) {
        yield* Effect.logError(`Command ${commandId} failed`, commandError);
        const commandErrorMessage = yield* getCommandErrorMessage(commandError);
        yield* vscodeUtils.showErrorNotificationWithoutWaiting(commandErrorMessage.message, commandErrorMessage);
      });

      const showInvalidArguments = Effect.fn("RegisterCommandMiddleware.showInvalidArguments")(function* (
        commandId: string,
        invalidArgument: unknown
      ) {
        yield* Effect.logError(`Command ${commandId} got unexpected arguments`, invalidArgument);
        yield* vscodeUtils.showErrorNotificationWithoutWaiting(APP_ERRORS.INVALID_COMMAND_ARGUMENTS(commandId));
      });

      const registerCommand = Effect.fn("RegisterCommandMiddleware.registerCommand")(function* <
        CommandError extends {readonly _tag: string},
        R
      >(
        commandId: string,
        controller: (
          ...commandArguments: readonly unknown[]
        ) => Effect.Effect<unknown, NoInfer<CommandError> | VscodeUtilsErrors["InvalidVsCodeArgumentError"], R>,
        getCommandErrorMessage: (commandError: CommandError) => Effect.Effect<CommandErrorMessage>
      ) {
        const commandContext = yield* Effect.context<R>();
        const runPromise = Effect.runPromiseWith(commandContext);
        // eslint-disable-next-line aggregor/span-name -- a command's root span is named by its command ID
        const runCommand = Effect.fn(commandId, {root: true})(
          function* (commandArguments: readonly unknown[]) {
            return yield* controller(...commandArguments);
          },
          Effect.catchTag("InvalidVsCodeArgumentError", (invalidArgument) =>
            showInvalidArguments(commandId, invalidArgument)
          ),
          Effect.catch((commandError) => showCommandError(commandId, commandError, getCommandErrorMessage)),
          Effect.tapCause((cause) => Effect.logError(`Command ${commandId} crashed`, cause))
        );

        yield* vscodeUtils.acquireScopedDisposable(() =>
          vsCodeApi.commands.registerCommand(commandId, (...commandArguments: unknown[]) =>
            runPromise(runCommand(commandArguments))
          )
        );
      });

      return {registerCommand};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
