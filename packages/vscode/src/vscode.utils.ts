import {APP_LABELS, APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {SETTINGS_EDITOR_EXTENSION_FILTER, VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect, Queue, Stream} from "effect";

import type {Disposable, Event, ProgressOptions} from "vscode";

export const acquireScopedDisposable = Effect.fn("acquireScopedDisposable")(function* <
  VsCodeDisposable extends Disposable
>(createVsCodeDisposable: () => VsCodeDisposable) {
  return yield* Effect.acquireRelease(Effect.sync(createVsCodeDisposable), (vsCodeDisposable) =>
    Effect.sync(() => {
      vsCodeDisposable.dispose();
    })
  );
});

// The listener is disposed when whoever runs the stream closes its scope.
export const streamVsCodeEvent = Effect.fn("streamVsCodeEvent")(function* <EventValue>(vsCodeEvent: Event<EventValue>) {
  return Stream.callback<EventValue>((eventQueue) =>
    acquireScopedDisposable(() => vsCodeEvent((eventValue) => Queue.offerUnsafe(eventQueue, eventValue)))
  );
});

export const setWhenClauseContextKey = Effect.fn("setWhenClauseContextKey")(function* (
  contextKey: string,
  contextValue: unknown
) {
  const vsCodeApi = yield* VsCodeApi;

  yield* Effect.promise(() =>
    vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.SET_CONTEXT, contextKey, contextValue)
  );
});

// The effect's failure comes back out once the progress ends.
export const runWithProgressIndicator = Effect.fn("runWithProgressIndicator")(function* <A, E, R>(
  progressOptions: ProgressOptions,
  effectToRun: Effect.Effect<A, E, R>
) {
  const vsCodeApi = yield* VsCodeApi;
  const effectContext = yield* Effect.context<R>();
  const runPromise = Effect.runPromiseWith(effectContext);
  const effectResult = yield* Effect.promise(() =>
    vsCodeApi.window.withProgress(progressOptions, () => runPromise(Effect.result(effectToRun)))
  );

  return yield* Effect.fromResult(effectResult);
});

export const openAggregorSettingsInSettingsEditor = Effect.fn("openAggregorSettingsInSettingsEditor")(function* () {
  const vsCodeApi = yield* VsCodeApi;

  yield* Effect.promise(() =>
    vsCodeApi.commands.executeCommand(
      VS_CODE_COMMANDS.OPEN_SETTINGS,
      `${SETTINGS_EDITOR_EXTENSION_FILTER}${vsCodeApi.extensionId}`
    )
  );
});

// Without waiting for the user to dismiss it, so whatever failed can finish now.
export const showErrorNotificationWithoutWaiting = Effect.fn("showErrorNotificationWithoutWaiting")(function* (
  errorMessage: string,
  errorButtons: {
    readonly pageToOpen?: {readonly label: string; readonly url: string} | undefined;
    readonly settingToOpen?: string | undefined;
  } = {}
) {
  const vsCodeApi = yield* VsCodeApi;
  const settingButtons = errorButtons.settingToOpen === undefined ? [] : [APP_LABELS.OPEN_SETTINGS];
  const pageButtons = errorButtons.pageToOpen === undefined ? [] : [errorButtons.pageToOpen.label];
  const showErrorMessageAndWaitForButton = Effect.promise(() =>
    vsCodeApi.window.showErrorMessage(`${APP_NAME}: ${errorMessage}`, ...settingButtons, ...pageButtons)
  );

  const pageToOpen = errorButtons.pageToOpen;

  yield* Effect.forkDetach(
    Effect.flatMap(showErrorMessageAndWaitForButton, (chosenButton) => {
      if (chosenButton === APP_LABELS.OPEN_SETTINGS && errorButtons.settingToOpen !== undefined)
        return Effect.promise(() =>
          vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.OPEN_SETTINGS, errorButtons.settingToOpen)
        );
      if (pageToOpen !== undefined && chosenButton === pageToOpen.label)
        return Effect.promise(() => vsCodeApi.env.openExternal(vsCodeApi.Uri.parse(pageToOpen.url)));

      return Effect.void;
    })
  );
});
