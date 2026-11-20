import {APP_LABELS, APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {SETTINGS_EDITOR_EXTENSION_FILTER, VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Context, Effect, Layer, Queue, Schema, Stream} from "effect";

import type {Disposable, Event, ProgressOptions} from "vscode";

interface ErrorButtons {
  readonly commandToRun?: {readonly commandId: string; readonly label: string} | undefined;
  readonly pageToOpen?: {readonly label: string; readonly url: string} | undefined;
  readonly settingToOpen?: string | undefined;
}

export class VscodeUtilsErrors extends TaggedErrors({
  InvalidVsCodeArgumentError: {cause: Schema.Unknown}
}) {}

export class VscodeUtils extends Context.Service<VscodeUtils>()("@pkg/vscode/vscode.utils/VscodeUtils", {
  make: Effect.fn("make")(function* () {
    const vsCodeApi = yield* VsCodeApi;

    const acquireScopedDisposable = Effect.fn("acquireScopedDisposable")(function* <
      VsCodeDisposable extends Disposable
    >(createVsCodeDisposable: () => VsCodeDisposable) {
      return yield* Effect.acquireRelease(Effect.sync(createVsCodeDisposable), (vsCodeDisposable) =>
        Effect.sync(() => {
          vsCodeDisposable.dispose();
        })
      );
    });

    const streamVsCodeEvent = Effect.fn("streamVsCodeEvent")(function* <EventValue>(vsCodeEvent: Event<EventValue>) {
      return Stream.callback<EventValue>((eventQueue) =>
        acquireScopedDisposable(() => vsCodeEvent((eventValue) => Queue.offerUnsafe(eventQueue, eventValue)))
      );
    });

    const setWhenClauseContextKey = Effect.fn("setWhenClauseContextKey")(function* (
      contextKey: string,
      contextValue: unknown
    ) {
      yield* Effect.promise(() =>
        vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.SET_CONTEXT, contextKey, contextValue)
      );
    });

    const runWithProgressIndicator = Effect.fn("runWithProgressIndicator")(function* <A, E, R>(
      progressOptions: ProgressOptions,
      effectToRun: Effect.Effect<A, E, R>
    ) {
      const effectContext = yield* Effect.context<R>();
      const runPromise = Effect.runPromiseWith(effectContext);
      const effectResult = yield* Effect.promise(() =>
        vsCodeApi.window.withProgress(progressOptions, () => runPromise(Effect.result(effectToRun)))
      );

      return yield* Effect.fromResult(effectResult);
    });

    const openAggregorSettingsInSettingsEditor = Effect.fn("openAggregorSettingsInSettingsEditor")(function* () {
      yield* Effect.promise(() =>
        vsCodeApi.commands.executeCommand(
          VS_CODE_COMMANDS.OPEN_SETTINGS,
          `${SETTINGS_EDITOR_EXTENSION_FILTER}${vsCodeApi.extensionId}`
        )
      );
    });

    const runChosenErrorButton = Effect.fn("runChosenErrorButton")(function* (
      errorButtons: ErrorButtons,
      chosenButton: string | undefined
    ) {
      const pageToOpen = errorButtons.pageToOpen;
      const commandToRun = errorButtons.commandToRun;
      if (chosenButton === APP_LABELS.OPEN_SETTINGS && errorButtons.settingToOpen !== undefined)
        yield* Effect.promise(() =>
          vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.OPEN_SETTINGS, errorButtons.settingToOpen)
        );
      if (pageToOpen !== undefined && chosenButton === pageToOpen.label)
        yield* Effect.promise(() => vsCodeApi.env.openExternal(vsCodeApi.Uri.parse(pageToOpen.url)));
      if (commandToRun !== undefined && chosenButton === commandToRun.label)
        yield* Effect.promise(() => vsCodeApi.commands.executeCommand(commandToRun.commandId));
    });

    const showErrorNotificationWithoutWaiting = Effect.fn("showErrorNotificationWithoutWaiting")(function* (
      errorMessage: string,
      errorButtons: ErrorButtons = {}
    ) {
      const settingButtons = errorButtons.settingToOpen === undefined ? [] : [APP_LABELS.OPEN_SETTINGS];
      const pageButtons = errorButtons.pageToOpen === undefined ? [] : [errorButtons.pageToOpen.label];
      const commandButtons = errorButtons.commandToRun === undefined ? [] : [errorButtons.commandToRun.label];
      const showErrorMessageAndWaitForButton = Effect.promise(() =>
        vsCodeApi.window.showErrorMessage(
          `${APP_NAME}: ${errorMessage}`,
          ...settingButtons,
          ...pageButtons,
          ...commandButtons
        )
      );

      yield* Effect.forkDetach(
        Effect.flatMap(showErrorMessageAndWaitForButton, (chosenButton) =>
          runChosenErrorButton(errorButtons, chosenButton)
        )
      );
    });

    const decodeVsCodeArgument = Effect.fn("decodeVsCodeArgument")(function* <ArgumentSchema extends Schema.Constraint>(
      argumentSchema: ArgumentSchema,
      vsCodeArgument: unknown
    ) {
      return yield* Effect.mapError(Schema.decodeUnknownEffect(argumentSchema)(vsCodeArgument), (cause) =>
        VscodeUtilsErrors.InvalidVsCodeArgumentError.make({cause})
      );
    });

    return {
      acquireScopedDisposable,
      decodeVsCodeArgument,
      openAggregorSettingsInSettingsEditor: openAggregorSettingsInSettingsEditor(),
      runWithProgressIndicator,
      setWhenClauseContextKey,
      showErrorNotificationWithoutWaiting,
      streamVsCodeEvent
    };
  })
}) {
  public static readonly layer = Layer.effect(this, ownSpans("VscodeUtils", this.make()));
}
