import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {acquireDisposable} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {COMMAND_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect} from "effect";

import type {PromptClient} from "@/application/clients/prompt.client.ts";
import type {InvalidCommandArguments} from "@/presentation/errors/command.error.ts";

// Registered for the surrounding scope's lifetime. Each run is a root span named by the command ID, and a crash is
// logged. Controllers handle their own errors except arguments that do not decode, which point at a broken menu entry:
// those are logged and shown.
export const registerCommand = Effect.fn("registerCommand")(function* <R>(
  commandId: string,
  controller: (...commandArguments: readonly unknown[]) => Effect.Effect<unknown, InvalidCommandArguments, R>
) {
  const {commands} = yield* VsCodeService;
  const runPromise = Effect.runPromiseWith(yield* Effect.context<PromptClient | R>());
  const runCommand = Effect.fn(commandId, {root: true})(
    function* (commandArguments: readonly unknown[]) {
      return yield* controller(...commandArguments);
    },
    Effect.catchTag("InvalidCommandArguments", (invalidCommandArguments) =>
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
