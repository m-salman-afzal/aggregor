import {
  watchSessionListChangesForSessionsView,
  watchViewedSessionIdsForSessionsView
} from "@controllers/session.controller.ts";
import {AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {
  SESSIONS_VIEW,
  SESSIONS_VIEW_SETTINGS,
  SESSIONS_WEBVIEW_COMMANDS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {
  drawAgents,
  drawAppearance,
  drawChange,
  drawEverything,
  drawViewedSession,
  drawWaitingCounts
} from "@views/sessions/sessionsDrawing.utils.ts";
import {makeWebviewHtml, setUpWebviewOptions} from "@views/sessions/sessionsPage.utils.ts";
import {Array, Effect, Layer, Match, Ref, Result, Schema, Stream} from "effect";

import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {RowCommandArgument} from "@views/sessions/sessions.view.type.ts";
import type {WebviewView} from "vscode";

// VS Code shows the view's webview the first time the view comes into sight, and disposes it when the view closes.
class WebviewNotShownError extends Schema.TaggedError<WebviewNotShownError, {readonly brand: unique symbol}>()(
  "WebviewNotShownError",
  {}
) {}

class RowCommandFailedError extends Schema.TaggedError<RowCommandFailedError, {readonly brand: unique symbol}>()(
  "RowCommandFailedError",
  {cause: Schema.Unknown, commandId: Schema.String}
) {}

type WebviewViewReference = Ref.Ref<Result.Result<WebviewView, WebviewNotShownError>>;

const SessionsWebviewMessageSchema = Schema.TaggedUnion({
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: {},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: {
    commandArgument: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    commandId: Schema.Literals(SESSIONS_WEBVIEW_COMMANDS)
  }
});

const findShownWebviewView = Effect.fn("SessionsView.findShownWebviewView")(function* (
  webviewViewReference: WebviewViewReference
) {
  const webviewViewResult = yield* Ref.get(webviewViewReference);

  return yield* Effect.fromResult(webviewViewResult);
});

const redrawChange = Effect.fn("SessionsView.redrawChange")(
  function* (webviewViewReference: WebviewViewReference, sessionListChange: SessionListChangeDto) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawChange(webviewView, sessionListChange);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void),
  Effect.catch((drawError) => Effect.logWarning("Could not redraw the Sessions view", drawError))
);

const redrawViewedSession = Effect.fn("SessionsView.redrawViewedSession")(
  function* (webviewViewReference: WebviewViewReference) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawViewedSession(webviewView);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void)
);

const runRowCommand = Effect.fn("SessionsView.runRowCommand")(function* (
  commandId: string,
  commandArgument: RowCommandArgument | undefined
) {
  const vsCodeApi = yield* VsCodeApi;
  const commandArguments = commandArgument === undefined ? [] : [commandArgument];
  yield* Effect.annotateCurrentSpan({commandId});

  yield* Effect.tryPromise({
    catch: (cause) => RowCommandFailedError.make({cause, commandId}),
    try: () => vsCodeApi.commands.executeCommand(commandId, ...commandArguments)
  });
});

// Until VS Code first shows the view there are no counts to draw, and a failed read leaves them as they were.
const updateWaitingCounts = Effect.fn("SessionsView.updateWaitingCounts")(
  function* (webviewViewReference: WebviewViewReference) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawWaitingCounts(webviewView);
  },
  Effect.ignore({log: "Debug", message: "Could not update the Sessions view's badge and counts"})
);

const redrawAppearance = Effect.fn("SessionsView.redrawAppearance")(
  function* (webviewViewReference: WebviewViewReference) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawAppearance(webviewView);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void)
);

const redrawAgents = Effect.fn("SessionsView.redrawAgents")(
  function* (webviewViewReference: WebviewViewReference) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawAgents(webviewView);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void),
  Effect.catch((drawError) => Effect.logWarning("Could not redraw the Sessions view's agents", drawError))
);

// The webview asks once its script listens, which is again each time VS Code shows the view after hiding it.
const handleWebviewMessage = Effect.fn("SessionsView.handleWebviewMessage", {root: true})(
  function* (webviewView: WebviewView, webviewMessage: unknown) {
    const sessionsWebviewMessage = yield* decodeVsCodeArgument(SessionsWebviewMessageSchema, webviewMessage);

    yield* Match.valueTags(sessionsWebviewMessage, {
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: () => drawEverything(webviewView),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: (runCommand) =>
        runRowCommand(runCommand.commandId, runCommand.commandArgument)
    });
  },
  Effect.catch((messageError) => Effect.logWarning("Could not answer the Sessions view's webview", messageError))
);

const attachWebviewView = Effect.fn("SessionsView.attachWebviewView")(function* (
  webviewViewReference: WebviewViewReference,
  webviewView: WebviewView
) {
  yield* setUpWebviewOptions(webviewView.webview);
  const webviewHtml = yield* makeWebviewHtml(webviewView.webview);
  yield* Effect.sync(() => {
    webviewView.webview.html = webviewHtml;
  });
  yield* Ref.set(webviewViewReference, Result.succeed(webviewView));
  yield* updateWaitingCounts(webviewViewReference);
});

const detachWebviewView = Effect.fn("SessionsView.detachWebviewView")(function* (
  webviewViewReference: WebviewViewReference
) {
  yield* Ref.set(webviewViewReference, Result.fail(WebviewNotShownError.make()));
});

type SessionsViewServices =
  | Effect.Services<ReturnType<typeof attachWebviewView | typeof detachWebviewView | typeof handleWebviewMessage>>
  | VsCodeApi;

type RunPromise = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => Promise<A>;

const makeRunPromise = Effect.fn("SessionsView.makeRunPromise")(function* () {
  const sessionsViewContext = yield* Effect.context<SessionsViewServices>();
  const runPromise: RunPromise = Effect.runPromiseWith(sessionsViewContext);

  return runPromise;
});

// VS Code disposes the webview's events with it.
const registerWebviewViewProvider = Effect.fn("SessionsView.registerWebviewViewProvider")(function* (
  webviewViewReference: WebviewViewReference,
  runPromise: RunPromise
) {
  const vsCodeApi = yield* VsCodeApi;

  yield* acquireScopedDisposable(() =>
    vsCodeApi.window.registerWebviewViewProvider(SESSIONS_VIEW.ID, {
      resolveWebviewView: (webviewView) => {
        webviewView.webview.onDidReceiveMessage((webviewMessage) =>
          runPromise(handleWebviewMessage(webviewView, webviewMessage))
        );
        webviewView.onDidDispose(() => runPromise(detachWebviewView(webviewViewReference)));

        return runPromise(attachWebviewView(webviewViewReference, webviewView));
      }
    })
  );
});

const watchSettingChanges = Effect.fn("SessionsView.watchSettingChanges")(function* (settingKeys: readonly string[]) {
  const vsCodeApi = yield* VsCodeApi;
  const configChanges = yield* streamVsCodeEvent(vsCodeApi.workspace.onDidChangeConfiguration);

  return Stream.filter(configChanges, (configChange) =>
    Array.some(settingKeys, (settingKey) => configChange.affectsConfiguration(`${SETTINGS_SECTION}.${settingKey}`))
  );
});

const makeSessionsView = Effect.fn("SessionsView.make")(function* () {
  const webviewViewReference = yield* Ref.make<Result.Result<WebviewView, WebviewNotShownError>>(
    Result.fail(WebviewNotShownError.make())
  );
  const runPromise = yield* makeRunPromise();
  yield* registerWebviewViewProvider(webviewViewReference, runPromise);
  const sessionListChanges = yield* watchSessionListChangesForSessionsView();
  const viewedSessionIds = yield* watchViewedSessionIdsForSessionsView();
  const appearanceChanges = yield* watchSettingChanges([
    SESSIONS_VIEW_SETTINGS.FONT_SIZE,
    SESSIONS_VIEW_SETTINGS.ACCENT_COLOR
  ]);
  const agentSettingChanges = yield* watchSettingChanges([
    AGENT_SETTINGS.AGENTS,
    AGENT_SETTINGS.DEFAULT_AGENT,
    AGENT_SETTINGS.SKIP_AGENT_PICKER
  ]);

  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      Effect.andThen(redrawChange(webviewViewReference, sessionListChange), updateWaitingCounts(webviewViewReference))
    )
  );
  yield* Effect.forkScoped(Stream.runForEach(viewedSessionIds, () => redrawViewedSession(webviewViewReference)));
  yield* Effect.forkScoped(Stream.runForEach(appearanceChanges, () => redrawAppearance(webviewViewReference)));
  yield* Effect.forkScoped(Stream.runForEach(agentSettingChanges, () => redrawAgents(webviewViewReference)));
});

export const SessionsView = Layer.effectDiscard(makeSessionsView());
