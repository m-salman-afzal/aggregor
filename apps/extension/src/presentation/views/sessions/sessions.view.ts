import {
  watchSessionListChangesForSessionsView,
  watchViewedSessionIdsForSessionsView
} from "@controllers/session.controller.ts";
import {watchSessionProcessesForSessionsView} from "@controllers/sessionProcess.controller.ts";
import {AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {
  SESSION_LISTS,
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
  drawBranches,
  drawChange,
  drawEverything,
  drawImportableSessions,
  drawLeftovers,
  drawMoreSessions,
  drawPullRequests,
  drawSessionProcesses,
  drawViewedSession,
  drawWaitingCounts
} from "@views/sessions/sessionsDrawing.utils.ts";
import {makeWebviewHtml, setUpWebviewOptions} from "@views/sessions/sessionsPage.utils.ts";
import {Array, Effect, Layer, Match, Ref, Result, Schema, Stream, SubscriptionRef} from "effect";

import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {SessionProcessesDto} from "@dtos/sessionProcess.dto.ts";
import type {CommandRequest, OpenDropdownSessionIds, ShownSessionPages} from "@views/sessions/sessions.view.type.ts";
import type {WebviewView} from "vscode";

// What the view keeps for the window's life: the pages each list shows, and the dropdowns the webview has open.
interface SessionsViewState {
  readonly openDropdownSessionIds: OpenDropdownSessionIds;
  readonly shownSessionPages: ShownSessionPages;
}

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
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_BRANCHES]: {projectPath: Schema.String},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_IMPORTABLE_SESSIONS]: {projectPath: Schema.String},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_LEFTOVERS]: {projectPath: Schema.String},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_PULL_REQUESTS]: {sessionId: Schema.String},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: {},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: {
    commandArgument: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    commandId: Schema.Literals(SESSIONS_WEBVIEW_COMMANDS)
  },
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.SHOW_MORE_SESSIONS]: {
    listId: Schema.Literals([SESSION_LISTS.ARCHIVE, SESSION_LISTS.SESSIONS]),
    projectPath: Schema.String
  },
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.WATCH_SESSION_PROCESSES]: {sessionIds: Schema.Array(Schema.String)}
});

const findShownWebviewView = Effect.fn("SessionsView.findShownWebviewView")(function* (
  webviewViewReference: WebviewViewReference
) {
  const webviewViewResult = yield* Ref.get(webviewViewReference);

  return yield* Effect.fromResult(webviewViewResult);
});

const redrawChange = Effect.fn("SessionsView.redrawChange")(
  function* (
    webviewViewReference: WebviewViewReference,
    shownSessionPages: ShownSessionPages,
    sessionListChange: SessionListChangeDto
  ) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawChange(webviewView, shownSessionPages, sessionListChange);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void),
  Effect.catch((drawError) => Effect.logWarning("Could not redraw the Sessions view", drawError))
);

const redrawSessionProcesses = Effect.fn("SessionsView.redrawSessionProcesses")(
  function* (webviewViewReference: WebviewViewReference, sessionProcesses: SessionProcessesDto) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawSessionProcesses(webviewView, sessionProcesses);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void)
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
  commandArgument: CommandRequest | undefined
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
  function* (webviewView: WebviewView, sessionsViewState: SessionsViewState, webviewMessage: unknown) {
    const sessionsWebviewMessage = yield* decodeVsCodeArgument(SessionsWebviewMessageSchema, webviewMessage);

    yield* Match.valueTags(sessionsWebviewMessage, {
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_BRANCHES]: (listBranches) =>
        drawBranches(webviewView, listBranches.projectPath),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_IMPORTABLE_SESSIONS]: (listImportableSessions) =>
        drawImportableSessions(webviewView, listImportableSessions.projectPath),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_LEFTOVERS]: (listLeftovers) =>
        drawLeftovers(webviewView, listLeftovers.projectPath),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_PULL_REQUESTS]: (listPullRequests) =>
        drawPullRequests(webviewView, listPullRequests.sessionId),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: () => drawEverything(webviewView, sessionsViewState.shownSessionPages),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: (runCommand) =>
        runRowCommand(runCommand.commandId, runCommand.commandArgument),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.SHOW_MORE_SESSIONS]: (showMoreSessions) =>
        drawMoreSessions(webviewView, sessionsViewState.shownSessionPages, showMoreSessions),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.WATCH_SESSION_PROCESSES]: (watchSessionProcesses) =>
        SubscriptionRef.set(sessionsViewState.openDropdownSessionIds, watchSessionProcesses.sessionIds)
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

// A hidden view reads no processes; the webview asks again for its open dropdowns once it is shown.
const detachWebviewView = Effect.fn("SessionsView.detachWebviewView")(function* (
  webviewViewReference: WebviewViewReference,
  openDropdownSessionIds: OpenDropdownSessionIds
) {
  yield* Ref.set(webviewViewReference, Result.fail(WebviewNotShownError.make()));
  yield* SubscriptionRef.set(openDropdownSessionIds, []);
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
  sessionsViewState: SessionsViewState,
  runPromise: RunPromise
) {
  const vsCodeApi = yield* VsCodeApi;

  yield* acquireScopedDisposable(() =>
    vsCodeApi.window.registerWebviewViewProvider(SESSIONS_VIEW.ID, {
      resolveWebviewView: (webviewView) => {
        webviewView.webview.onDidReceiveMessage((webviewMessage) =>
          runPromise(handleWebviewMessage(webviewView, sessionsViewState, webviewMessage))
        );
        webviewView.onDidDispose(() =>
          runPromise(detachWebviewView(webviewViewReference, sessionsViewState.openDropdownSessionIds))
        );

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

// Kept for the window's life, so a list keeps the pages it showed when VS Code shows the view again.
const makeShownSessionPages = Effect.fn("SessionsView.makeShownSessionPages")(function* () {
  const shownSessionPages: ShownSessionPages = yield* Ref.make({
    [SESSION_LISTS.ARCHIVE]: {},
    [SESSION_LISTS.SESSIONS]: {}
  });

  return shownSessionPages;
});

// Each open dropdown's processes, read while the webview shows it; every 2 seconds, so its redraws go untraced.
const startSessionProcessRedraws = Effect.fn("SessionsView.startSessionProcessRedraws")(function* (
  webviewViewReference: WebviewViewReference,
  openDropdownSessionIds: OpenDropdownSessionIds
) {
  const sessionProcessReadings = yield* watchSessionProcessesForSessionsView(
    SubscriptionRef.changes(openDropdownSessionIds)
  );

  yield* Effect.forkScoped(
    Stream.runForEach(sessionProcessReadings, (sessionProcesses) =>
      Effect.withTracerEnabled(redrawSessionProcesses(webviewViewReference, sessionProcesses), false)
    )
  );
});

const startSettingRedraws = Effect.fn("SessionsView.startSettingRedraws")(function* (
  webviewViewReference: WebviewViewReference
) {
  const appearanceChanges = yield* watchSettingChanges([
    SESSIONS_VIEW_SETTINGS.FONT_SIZE,
    SESSIONS_VIEW_SETTINGS.ACCENT_COLOR
  ]);
  const agentSettingChanges = yield* watchSettingChanges([
    AGENT_SETTINGS.AGENTS,
    AGENT_SETTINGS.DEFAULT_AGENT,
    AGENT_SETTINGS.SKIP_AGENT_PICKER
  ]);

  yield* Effect.forkScoped(Stream.runForEach(appearanceChanges, () => redrawAppearance(webviewViewReference)));
  yield* Effect.forkScoped(Stream.runForEach(agentSettingChanges, () => redrawAgents(webviewViewReference)));
});

const makeSessionsView = Effect.fn("SessionsView.make")(function* () {
  const webviewViewReference = yield* Ref.make<Result.Result<WebviewView, WebviewNotShownError>>(
    Result.fail(WebviewNotShownError.make())
  );
  const sessionsViewState: SessionsViewState = {
    openDropdownSessionIds: yield* SubscriptionRef.make<readonly string[]>([]),
    shownSessionPages: yield* makeShownSessionPages()
  };
  const runPromise = yield* makeRunPromise();
  yield* registerWebviewViewProvider(webviewViewReference, sessionsViewState, runPromise);
  const sessionListChanges = yield* watchSessionListChangesForSessionsView();
  const viewedSessionIds = yield* watchViewedSessionIdsForSessionsView();

  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      Effect.andThen(
        redrawChange(webviewViewReference, sessionsViewState.shownSessionPages, sessionListChange),
        updateWaitingCounts(webviewViewReference)
      )
    )
  );
  yield* Effect.forkScoped(Stream.runForEach(viewedSessionIds, () => redrawViewedSession(webviewViewReference)));
  yield* startSessionProcessRedraws(webviewViewReference, sessionsViewState.openDropdownSessionIds);
  yield* startSettingRedraws(webviewViewReference);
});

export const SessionsView = Layer.effectDiscard(makeSessionsView());
