import {acquireDisposable} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {MODEL_ICONS} from "@pkg/constants/src/extension.constant.ts";
import {Effect} from "effect";

// Registered for the surrounding scope's lifetime. Each run is a root span named by the command ID, and a crash is
// logged. Handlers handle their own errors (E = never) and type their own parameters: VS Code passes them untyped.
export const registerCommand = Effect.fn("registerCommand")(function* <R>(
  commandId: string,
  handler: (...commandArguments: any[]) => Effect.Effect<unknown, never, R>
) {
  const {commands} = yield* VsCodeService;
  const runPromise = Effect.runPromiseWith(yield* Effect.context<R>());
  const runCommand = Effect.fn(commandId, {root: true})(
    function* (commandArguments: readonly unknown[]) {
      return yield* handler(...commandArguments);
    },
    Effect.tapCause((cause) => Effect.logError(`Command ${commandId} failed`, cause))
  );

  yield* acquireDisposable(() =>
    commands.registerCommand(commandId, async (...commandArguments: unknown[]) =>
      runPromise(runCommand(commandArguments))
    )
  );
});

// Claude's brand orange reads on light and dark themes, so one file serves both.
export const getClaudeIcon = Effect.fn("getClaudeIcon")(function* () {
  const {extensionUri, Uri} = yield* VsCodeService;

  return Uri.joinPath(extensionUri, MODEL_ICONS.CLAUDE);
});
