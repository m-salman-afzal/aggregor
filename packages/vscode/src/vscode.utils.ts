import {APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect, Queue, Stream} from "effect";

import type {Disposable, Event, ProgressOptions} from "vscode";

// A VS Code resource that lives as long as the surrounding scope: it is disposed when the scope closes.
export const acquireDisposable = Effect.fn("acquireDisposable")(function* <A extends Disposable>(
  createDisposable: () => A
) {
  return yield* Effect.acquireRelease(Effect.sync(createDisposable), (disposable) =>
    Effect.sync(() => {
      disposable.dispose();
    })
  );
});

// A VS Code event as a Stream. The listener is disposed when whoever runs the stream closes its scope.
export const fromEvent = Effect.fn("fromEvent")(function* <A>(event: Event<A>) {
  return Stream.callback<A>((queue) => acquireDisposable(() => event((value) => Queue.offerUnsafe(queue, value))));
});

export const setContext = Effect.fn("setContext")(function* (contextKey: string, contextValue: unknown) {
  const {commands} = yield* VsCodeApi;

  yield* Effect.promise(() => commands.executeCommand("setContext", contextKey, contextValue));
});

// Shows VS Code's progress while the effect runs; the effect's failure comes back out once the progress ends.
export const withProgress = Effect.fn("withProgress")(function* <A, E, R>(
  progressOptions: ProgressOptions,
  effect: Effect.Effect<A, E, R>
) {
  const {window} = yield* VsCodeApi;
  const effectContext = yield* Effect.context<R>();
  const runPromise = Effect.runPromiseWith(effectContext);
  const effectResult = yield* Effect.promise(() =>
    window.withProgress(progressOptions, () => runPromise(Effect.result(effect)))
  );

  return yield* Effect.fromResult(effectResult);
});

// Shows the message without waiting for the user to dismiss it, so whatever failed can finish now.
export const showErrorInBackground = Effect.fn("showErrorInBackground")(function* (errorMessage: string) {
  const {window} = yield* VsCodeApi;

  yield* Effect.forkDetach(Effect.promise(() => window.showErrorMessage(`${APP_NAME}: ${errorMessage}`)));
});
