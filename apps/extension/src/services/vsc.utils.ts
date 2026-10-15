import {VscService} from "@/services/vsc.service.ts";
import {MODEL_ICONS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Queue, Stream} from "effect";

import type {Event, ProgressOptions} from "vscode";

// A VS Code event as a Stream. The listener is disposed when whoever runs the stream closes its scope.
export const fromEvent = <A>(event: Event<A>) =>
  Stream.callback<A>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => event((value) => Queue.offerUnsafe(queue, value))),
      (listener) =>
        Effect.sync(() => {
          listener.dispose();
        })
    )
  );

// Registered for the lifetime of the surrounding scope. Handlers must handle their own errors (E = never).
// VS Code passes command arguments untyped, so each handler declares its own parameter types.
export const registerCommand = Effect.fn("registerCommand")(function* <R>(
  command: string,
  handler: (...args: any[]) => Effect.Effect<unknown, never, R>
) {
  const {commands} = yield* VscService;
  const run = Effect.runPromiseWith(yield* Effect.context<R>());

  yield* Effect.acquireRelease(
    Effect.sync(() => commands.registerCommand(command, async (...args: unknown[]) => run(handler(...args)))),
    (disposable) =>
      Effect.sync(() => {
        disposable.dispose();
      })
  );
});

export const setContext = Effect.fn("setContext")(function* (key: string, value: unknown) {
  const {commands} = yield* VscService;

  yield* Effect.promise(async () => commands.executeCommand("setContext", key, value));
});

export const withProgress = Effect.fn("withProgress")(function* <A, R>(
  options: ProgressOptions,
  effect: Effect.Effect<A, never, R>
) {
  const {window} = yield* VscService;
  const run = Effect.runPromiseWith(yield* Effect.context<R>());

  return yield* Effect.promise(async () => window.withProgress(options, async () => run(effect)));
});

// Claude's brand orange reads on light and dark themes, so one file serves both.
export const getClaudeIcon = Effect.fn("getClaudeIcon")(function* () {
  const {extensionUri, Uri} = yield* VscService;

  return Uri.joinPath(extensionUri, MODEL_ICONS.CLAUDE);
});
