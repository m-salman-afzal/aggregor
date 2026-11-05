import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
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

export const setContext = Effect.fn("setContext")(function* (contextKey: string, contextValue: unknown) {
  const {commands} = yield* VsCodeApi;

  yield* Effect.promise(() => commands.executeCommand("setContext", contextKey, contextValue));
});

export const withProgress = Effect.fn("withProgress")(function* <A, R>(
  progressOptions: ProgressOptions,
  effect: Effect.Effect<A, never, R>
) {
  const {window} = yield* VsCodeApi;
  const effectContext = yield* Effect.context<R>();
  const runPromise = Effect.runPromiseWith(effectContext);

  return yield* Effect.promise(() => window.withProgress(progressOptions, () => runPromise(effect)));
});
