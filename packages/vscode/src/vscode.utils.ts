import {APP_LABELS, APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {SETTINGS_EDITOR_EXTENSION_FILTER, VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect, Queue, Stream} from "effect";

import type {Disposable, Event, ProgressOptions} from "vscode";

// A VS Code resource that lives as long as the surrounding scope: it is disposed when the scope closes.
export const acquireScopedDisposable = Effect.fn("acquireScopedDisposable")(function* <
  VsCodeDisposable extends Disposable
>(createVsCodeDisposable: () => VsCodeDisposable) {
  return yield* Effect.acquireRelease(Effect.sync(createVsCodeDisposable), (vsCodeDisposable) =>
    Effect.sync(() => {
      vsCodeDisposable.dispose();
    })
  );
});

// A VS Code event as a Stream. The listener is disposed when whoever runs the stream closes its scope.
export const streamVsCodeEvent = Effect.fn("streamVsCodeEvent")(function* <EventValue>(vsCodeEvent: Event<EventValue>) {
  return Stream.callback<EventValue>((eventQueue) =>
    acquireScopedDisposable(() => vsCodeEvent((eventValue) => Queue.offerUnsafe(eventQueue, eventValue)))
  );
});

// Sets a context key that package.json's `when` clauses read, such as a menu item's visibility.
export const setWhenClauseContextKey = Effect.fn("setWhenClauseContextKey")(function* (
  contextKey: string,
  contextValue: unknown
) {
  const {commands} = yield* VsCodeApi;

  yield* Effect.promise(() => commands.executeCommand(VS_CODE_COMMANDS.SET_CONTEXT, contextKey, contextValue));
});

// Shows VS Code's progress indicator while the effect runs; the effect's failure comes back out once the progress ends.
export const runWithProgressIndicator = Effect.fn("runWithProgressIndicator")(function* <A, E, R>(
  progressOptions: ProgressOptions,
  effectToRun: Effect.Effect<A, E, R>
) {
  const {window} = yield* VsCodeApi;
  const effectContext = yield* Effect.context<R>();
  const runPromise = Effect.runPromiseWith(effectContext);
  const effectResult = yield* Effect.promise(() =>
    window.withProgress(progressOptions, () => runPromise(Effect.result(effectToRun)))
  );

  return yield* Effect.fromResult(effectResult);
});

// Opens the Settings editor at every Aggregor setting.
export const openAggregorSettingsInSettingsEditor = Effect.fn("openAggregorSettingsInSettingsEditor")(function* () {
  const {commands, extensionId} = yield* VsCodeApi;

  yield* Effect.promise(() =>
    commands.executeCommand(VS_CODE_COMMANDS.OPEN_SETTINGS, `${SETTINGS_EDITOR_EXTENSION_FILTER}${extensionId}`)
  );
});

// Shows the error notification without waiting for the user to dismiss it, so whatever failed can finish now. With a
// setting, an Open Settings button opens the Settings editor at it; with a page, a button named for it opens it.
export const showErrorNotificationWithoutWaiting = Effect.fn("showErrorNotificationWithoutWaiting")(function* (
  errorMessage: string,
  {
    pageToOpen,
    settingToOpen
  }: {
    readonly pageToOpen?: {readonly label: string; readonly url: string} | undefined;
    readonly settingToOpen?: string | undefined;
  } = {}
) {
  const {commands, env, Uri, window} = yield* VsCodeApi;
  const settingButtons = settingToOpen === undefined ? [] : [APP_LABELS.OPEN_SETTINGS];
  const pageButtons = pageToOpen === undefined ? [] : [pageToOpen.label];
  const showErrorMessageAndWaitForButton = Effect.promise(() =>
    window.showErrorMessage(`${APP_NAME}: ${errorMessage}`, ...settingButtons, ...pageButtons)
  );

  yield* Effect.forkDetach(
    Effect.flatMap(showErrorMessageAndWaitForButton, (chosenButton) => {
      if (chosenButton === APP_LABELS.OPEN_SETTINGS && settingToOpen !== undefined)
        return Effect.promise(() => commands.executeCommand(VS_CODE_COMMANDS.OPEN_SETTINGS, settingToOpen));
      if (pageToOpen !== undefined && chosenButton === pageToOpen.label)
        return Effect.promise(() => env.openExternal(Uri.parse(pageToOpen.url)));

      return Effect.void;
    })
  );
});
