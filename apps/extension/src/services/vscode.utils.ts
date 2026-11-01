import {VsCodeService} from "@/services/vscode.service.ts";
import {MODEL_ICONS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Queue, Stream} from "effect";

import type {Disposable, Event, ProgressOptions} from "vscode";

// A VS Code resource that lives as long as the surrounding scope: it is disposed when the scope closes.
export const acquireDisposable = <A extends Disposable>(createDisposable: () => A) =>
  Effect.acquireRelease(Effect.sync(createDisposable), (disposable) =>
    Effect.sync(() => {
      disposable.dispose();
    })
  );

// A VS Code event as a Stream. The listener is disposed when whoever runs the stream closes its scope.
export const fromEvent = <A>(event: Event<A>) =>
  Stream.callback<A>((queue) => acquireDisposable(() => event((value) => Queue.offerUnsafe(queue, value))));

// Registered for the lifetime of the surrounding scope. Handlers must handle their own errors (E = never); a defect is
// logged before VS Code reports the command as failed. Each run is a root span named by the command ID.
// VS Code passes command arguments untyped, so each handler declares its own parameter types.
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

export const setContext = Effect.fn("setContext")(function* (contextKey: string, contextValue: unknown) {
  const {commands} = yield* VsCodeService;

  yield* Effect.promise(async () => commands.executeCommand("setContext", contextKey, contextValue));
});

export const withProgress = Effect.fn("withProgress")(function* <A, R>(
  progressOptions: ProgressOptions,
  effect: Effect.Effect<A, never, R>
) {
  const {window} = yield* VsCodeService;
  const runPromise = Effect.runPromiseWith(yield* Effect.context<R>());

  return yield* Effect.promise(async () => window.withProgress(progressOptions, async () => runPromise(effect)));
});

// Claude's brand orange reads on light and dark themes, so one file serves both.
export const getClaudeIcon = Effect.fn("getClaudeIcon")(function* () {
  const {extensionUri, Uri} = yield* VsCodeService;

  return Uri.joinPath(extensionUri, MODEL_ICONS.CLAUDE);
});
