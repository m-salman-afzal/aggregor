import {listProjectsForSessionsView} from "@controllers/project.controller.ts";
import {
  findViewedSessionIdForSessionsView,
  getSessionListItemForSessionsView,
  listArchivedProjectSessionIdsForSessionsView,
  listArchivedProjectsForSessionsView,
  listProjectSessionIdsForSessionsView,
  listSessionsWaitingOnUserForSessionsView,
  watchSessionListChangesForSessionsView,
  watchViewedSessionIdsForSessionsView
} from "@controllers/session.controller.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {
  PROMPT_ANSWER_TAGS,
  PROMPT_TAGS,
  SESSIONS_VIEW,
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_VIEW_SETTINGS,
  SESSIONS_WEBVIEW_COMMANDS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS,
  STATUS_LABELS,
  VIEW_BADGE_LABELS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {ViewPromptAnswerSchema, ViewPromptSchema} from "@pkg/vscode/src/viewPrompt.schema.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {makeProjectNodeId, makeSessionNodeId} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  countViewSessionsWaitingOnUser,
  getAgentIconUri,
  makeIconWebviewUri,
  makeWebviewHtml,
  setUpWebviewOptions
} from "@views/sessions/sessions.utils.ts";
import {Array, Deferred, Effect, Layer, Match, Ref, Result, Schema, Stream, Struct} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {ViewPrompt, ViewPromptAnswer, ViewPromptChoice} from "@pkg/vscode/src/viewPrompt.type.ts";
import type {
  ProjectRowData,
  SessionRowData,
  SessionsViewMessage,
  WebviewPrompt,
  WebviewPromptChoice
} from "@views/sessions/sessions.view.type.ts";
import type {Webview, WebviewView} from "vscode";

type ListProjectSessionIds = typeof listProjectSessionIdsForSessionsView;

// One at a time: a new prompt cancels the last.
interface PendingPrompt {
  readonly answer: Deferred.Deferred<ViewPromptAnswer>;
  readonly viewPrompt: ViewPrompt;
}

// VS Code shows the view's webview the first time the view comes into sight, and disposes it when the view closes.
class WebviewNotShownError extends Schema.TaggedError<WebviewNotShownError, {readonly brand: unique symbol}>()(
  "WebviewNotShownError",
  {}
) {}

class NoPendingPromptError extends Schema.TaggedError<NoPendingPromptError, {readonly brand: unique symbol}>()(
  "NoPendingPromptError",
  {}
) {}

class RowCommandFailedError extends Schema.TaggedError<RowCommandFailedError, {readonly brand: unique symbol}>()(
  "RowCommandFailedError",
  {cause: Schema.Unknown, commandId: Schema.String}
) {}

type WebviewViewReference = Ref.Ref<Result.Result<WebviewView, WebviewNotShownError>>;

type PendingPromptReference = Ref.Ref<Result.Result<PendingPrompt, NoPendingPromptError>>;

const FontSizeSettingSchema = Schema.Finite.check(Schema.isBetween({maximum: 24, minimum: 10}));

const AccentColorSettingSchema = Schema.String.check(Schema.isPattern(SESSIONS_VIEW_SETTINGS.ACCENT_COLOR_PATTERN));

const SessionsWebviewMessageSchema = Schema.TaggedUnion({
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.PROMPT_ANSWERED]: {answer: ViewPromptAnswerSchema},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: {},
  [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: {
    commandId: Schema.Literals(SESSIONS_WEBVIEW_COMMANDS),
    nodeId: Schema.optional(Schema.String)
  }
});

const findShownWebviewView = Effect.fn("SessionsView.findShownWebviewView")(function* (
  webviewViewReference: WebviewViewReference
) {
  const webviewViewResult = yield* Ref.get(webviewViewReference);

  return yield* Effect.fromResult(webviewViewResult);
});

// A webview that isn't listening yet drops the message, and asks for everything once it listens.
const postToWebview = Effect.fn("SessionsView.postToWebview")(function* (
  webviewView: WebviewView,
  sessionsViewMessage: SessionsViewMessage
) {
  yield* Effect.promise(() => webviewView.webview.postMessage(sessionsViewMessage));
});

const readSessionRow = Effect.fn("SessionsView.readSessionRow")(function* (
  webviewView: WebviewView,
  sessionId: string
) {
  const sessionListItem = yield* getSessionListItemForSessionsView(sessionId);
  const sessionRow: SessionRowData = {
    ...(yield* getAgentIconUri(webviewView.webview, sessionListItem)),
    nodeId: yield* makeSessionNodeId(sessionId),
    sessionListItem
  };

  return sessionRow;
});

// A session removed meanwhile is left out; the change that removed it redraws its project.
const readSessionRowIfFound = Effect.fn("SessionsView.readSessionRowIfFound")(
  function* (webviewView: WebviewView, sessionId: string) {
    return [yield* readSessionRow(webviewView, sessionId)];
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.succeed([]))
);

const readProjectSessionRows = Effect.fn("SessionsView.readProjectSessionRows")(function* (
  webviewView: WebviewView,
  projectPath: string,
  listProjectSessionIds: ListProjectSessionIds
) {
  const sessionIds = yield* listProjectSessionIds(projectPath);
  const sessionRowLists = yield* Effect.forEach(sessionIds, (sessionId) =>
    readSessionRowIfFound(webviewView, sessionId)
  );

  return Array.flatten(sessionRowLists);
});

const readProjectRow = Effect.fn("SessionsView.readProjectRow")(function* (
  webviewView: WebviewView,
  projectListItem: ProjectListItemDto,
  listProjectSessionIds: ListProjectSessionIds
) {
  const projectRow: ProjectRowData = {
    nodeId: yield* makeProjectNodeId(projectListItem.path),
    projectListItem,
    sessionRows: yield* readProjectSessionRows(webviewView, projectListItem.path, listProjectSessionIds)
  };

  return projectRow;
});

const drawAllProjects = Effect.fn("SessionsView.drawAllProjects")(function* (webviewView: WebviewView) {
  const projectListItems = yield* listProjectsForSessionsView();
  const projectRows = yield* Effect.forEach(projectListItems, (projectListItem) =>
    readProjectRow(webviewView, projectListItem, listProjectSessionIdsForSessionsView)
  );

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN, projectRows});
});

// The Archive is small, so any change but a session's own redraws it whole.
const drawArchive = Effect.fn("SessionsView.drawArchive")(function* (webviewView: WebviewView) {
  const projectListItems = yield* listArchivedProjectsForSessionsView();
  const projectRows = yield* Effect.forEach(projectListItems, (projectListItem) =>
    readProjectRow(webviewView, projectListItem, listArchivedProjectSessionIdsForSessionsView)
  );

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.ARCHIVE_DRAWN, projectRows});
});

const drawProjectSessions = Effect.fn("SessionsView.drawProjectSessions")(function* (
  webviewView: WebviewView,
  projectPath: string
) {
  const sessionRows = yield* readProjectSessionRows(webviewView, projectPath, listProjectSessionIdsForSessionsView);

  yield* postToWebview(webviewView, {
    _tag: SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN,
    projectPath,
    sessionRows
  });
});

// A session removed meanwhile draws nothing: the change that removed it redraws its project.
const drawSession = Effect.fn("SessionsView.drawSession")(
  function* (webviewView: WebviewView, sessionId: string) {
    const sessionRow = yield* readSessionRow(webviewView, sessionId);

    yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN, sessionRow});
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

// With no session in front, the last one keeps its mark.
const drawViewedSession = Effect.fn("SessionsView.drawViewedSession")(
  function* (webviewView: WebviewView) {
    const viewedSessionId = yield* findViewedSessionIdForSessionsView();

    yield* postToWebview(webviewView, {
      _tag: SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED,
      sessionId: viewedSessionId
    });
  },
  Effect.catchTag("NoViewedSessionError", () => Effect.void)
);

const drawChange = Effect.fn("SessionsView.drawChange")(
  function* (webviewViewReference: WebviewViewReference, sessionListChange: SessionListChangeDto) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* Match.valueTags(sessionListChange, {
      ProjectListChanged: () => Effect.andThen(drawAllProjects(webviewView), drawArchive(webviewView)),
      ProjectSessionsChanged: (projectSessionsChanged) =>
        Effect.andThen(drawProjectSessions(webviewView, projectSessionsChanged.projectPath), drawArchive(webviewView)),
      SessionChanged: (sessionChanged) => drawSession(webviewView, sessionChanged.sessionId)
    });
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void),
  Effect.catch((drawError) => Effect.logWarning("Could not redraw the Sessions view", drawError))
);

const drawViewedSessionChange = Effect.fn("SessionsView.drawViewedSessionChange")(
  function* (webviewViewReference: WebviewViewReference) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawViewedSession(webviewView);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void)
);

const runRowCommand = Effect.fn("SessionsView.runRowCommand")(function* (
  commandId: string,
  nodeId: string | undefined
) {
  const vsCodeApi = yield* VsCodeApi;
  const commandArguments = nodeId === undefined ? [] : [nodeId];
  yield* Effect.annotateCurrentSpan({commandId});

  yield* Effect.tryPromise({
    catch: (cause) => RowCommandFailedError.make({cause, commandId}),
    try: () => vsCodeApi.commands.executeCommand(commandId, ...commandArguments)
  });
});

// VS Code shows the view's badge on the activity bar too.
const drawWaitingCounts = Effect.fn("SessionsView.drawWaitingCounts")(function* (webviewView: WebviewView) {
  const sessionsWaitingOnUser = yield* listSessionsWaitingOnUserForSessionsView();
  const tooltipLines = Array.map(sessionsWaitingOnUser, (sessionWaitingOnUser) =>
    VIEW_BADGE_LABELS.TOOLTIP_LINE(sessionWaitingOnUser.displayName, STATUS_LABELS[sessionWaitingOnUser.status])
  );
  const sessionsWaitingCount = yield* countViewSessionsWaitingOnUser(sessionsWaitingOnUser, false);
  const archiveWaitingCount = yield* countViewSessionsWaitingOnUser(sessionsWaitingOnUser, true);

  yield* Effect.sync(() => {
    webviewView.badge =
      tooltipLines.length === 0 ? undefined : {tooltip: Array.join(tooltipLines, "\n"), value: tooltipLines.length};
  });
  yield* postToWebview(webviewView, {
    _tag: SESSIONS_VIEW_MESSAGE_TAGS.WAITING_COUNTS_DRAWN,
    archiveWaitingCount,
    sessionsWaitingCount
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

// The look first, so the rows draw in it.
const drawAppearance = Effect.fn("SessionsView.drawAppearance")(function* (webviewView: WebviewView) {
  const vsCodeApi = yield* VsCodeApi;
  const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
  const fontSize = yield* Effect.orElseSucceed(
    Schema.decodeUnknownEffect(FontSizeSettingSchema)(configuredSettings.get(SESSIONS_VIEW_SETTINGS.FONT_SIZE)),
    () => SESSIONS_VIEW_SETTINGS.DEFAULT_FONT_SIZE
  );
  const accentColor = yield* Effect.orElseSucceed(
    Schema.decodeUnknownEffect(AccentColorSettingSchema)(configuredSettings.get(SESSIONS_VIEW_SETTINGS.ACCENT_COLOR)),
    () => SESSIONS_VIEW_SETTINGS.DEFAULT_ACCENT_COLOR
  );

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.APPEARANCE_DRAWN, accentColor, fontSize});
});

const drawAppearanceChange = Effect.fn("SessionsView.drawAppearanceChange")(
  function* (webviewViewReference: WebviewViewReference) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* drawAppearance(webviewView);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void)
);

const drawEverything = Effect.fn("SessionsView.drawEverything")(function* (webviewView: WebviewView) {
  yield* drawAppearance(webviewView);
  yield* drawAllProjects(webviewView);
  yield* drawArchive(webviewView);
  yield* drawViewedSession(webviewView);
  yield* Effect.ignore(drawWaitingCounts(webviewView), {
    log: "Debug",
    message: "Could not draw the Sessions view's counts"
  });
});

const toWebviewPromptChoice = Effect.fn("SessionsView.toWebviewPromptChoice")(function* (
  webview: Webview,
  promptChoice: ViewPromptChoice
) {
  const choiceWithoutIconPath = Struct.omit(promptChoice, ["iconPath"]);
  if (promptChoice.iconPath === undefined) return choiceWithoutIconPath;
  const webviewPromptChoice: WebviewPromptChoice = {
    ...choiceWithoutIconPath,
    iconUri: yield* makeIconWebviewUri(webview, promptChoice.iconPath)
  };

  return webviewPromptChoice;
});

const toWebviewPrompt = Effect.fn("SessionsView.toWebviewPrompt")(function* (webview: Webview, viewPrompt: ViewPrompt) {
  return yield* Match.valueTags(viewPrompt, {
    [PROMPT_TAGS.CHOICE]: (choicePrompt) =>
      Effect.map(
        Effect.forEach(choicePrompt.choices, (promptChoice) => toWebviewPromptChoice(webview, promptChoice)),
        (choices): WebviewPrompt => ({...choicePrompt, choices})
      ),
    [PROMPT_TAGS.QUESTION]: (questionPrompt) => Effect.succeed<WebviewPrompt>(questionPrompt),
    [PROMPT_TAGS.TEXT]: (textPrompt) => Effect.succeed<WebviewPrompt>(textPrompt)
  });
});

// A page that loads later asks to be drawn, and gets the prompt then.
const postPendingPrompt = Effect.fn("SessionsView.postPendingPrompt")(function* (
  webviewView: WebviewView,
  pendingPromptReference: PendingPromptReference
) {
  const pendingPromptResult = yield* Ref.get(pendingPromptReference);
  if (Result.isFailure(pendingPromptResult)) return;
  const webviewPrompt = yield* toWebviewPrompt(webviewView.webview, pendingPromptResult.success.viewPrompt);

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.PROMPT_SHOWN, prompt: webviewPrompt});
});

const answerPendingPrompt = Effect.fn("SessionsView.answerPendingPrompt")(function* (
  pendingPromptReference: PendingPromptReference,
  promptAnswer: ViewPromptAnswer
) {
  const pendingPromptResult = yield* Ref.getAndSet(pendingPromptReference, Result.fail(NoPendingPromptError.make()));
  if (Result.isFailure(pendingPromptResult)) return;

  yield* Deferred.succeed(pendingPromptResult.success.answer, promptAnswer);
});

const revealPrompt = Effect.fn("SessionsView.revealPrompt")(
  function* (webviewViewReference: WebviewViewReference, pendingPromptReference: PendingPromptReference) {
    const vsCodeApi = yield* VsCodeApi;
    yield* Effect.promise(() => vsCodeApi.commands.executeCommand(SESSIONS_VIEW.FOCUS_COMMAND));
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* postPendingPrompt(webviewView, pendingPromptReference);
  },
  Effect.catchTag("WebviewNotShownError", () => Effect.void)
);

// A prompt that doesn't decode is cancelled at once.
const showPrompt = Effect.fn("SessionsView.showPrompt")(
  function* (
    webviewViewReference: WebviewViewReference,
    pendingPromptReference: PendingPromptReference,
    promptArgument: unknown
  ) {
    const viewPrompt = yield* decodeVsCodeArgument(ViewPromptSchema, promptArgument);
    yield* answerPendingPrompt(pendingPromptReference, {_tag: PROMPT_ANSWER_TAGS.CANCELLED});
    const answer = yield* Deferred.make<ViewPromptAnswer>();
    yield* Ref.set(pendingPromptReference, Result.succeed({answer, viewPrompt}));
    yield* revealPrompt(webviewViewReference, pendingPromptReference);

    return yield* Deferred.await(answer);
  },
  Effect.catchTag("InvalidVsCodeArgumentError", (invalidPrompt) =>
    Effect.as(
      Effect.logWarning("Could not show a prompt in the Sessions view", invalidPrompt),
      ViewPromptAnswerSchema.make({_tag: PROMPT_ANSWER_TAGS.CANCELLED})
    )
  )
);

const drawEverythingWithPrompt = Effect.fn("SessionsView.drawEverythingWithPrompt")(function* (
  webviewView: WebviewView,
  pendingPromptReference: PendingPromptReference
) {
  yield* drawEverything(webviewView);
  yield* postPendingPrompt(webviewView, pendingPromptReference);
});

// The webview asks once its script listens, which is again each time VS Code shows the view after hiding it.
const handleWebviewMessage = Effect.fn("SessionsView.handleWebviewMessage", {root: true})(
  function* (webviewView: WebviewView, pendingPromptReference: PendingPromptReference, webviewMessage: unknown) {
    const sessionsWebviewMessage = yield* decodeVsCodeArgument(SessionsWebviewMessageSchema, webviewMessage);

    yield* Match.valueTags(sessionsWebviewMessage, {
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.PROMPT_ANSWERED]: (promptAnswered) =>
        answerPendingPrompt(pendingPromptReference, promptAnswered.answer),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: () => drawEverythingWithPrompt(webviewView, pendingPromptReference),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: (runCommand) =>
        runRowCommand(runCommand.commandId, runCommand.nodeId)
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

// A prompt can't be answered once the view closes.
const detachWebviewView = Effect.fn("SessionsView.detachWebviewView")(function* (
  webviewViewReference: WebviewViewReference,
  pendingPromptReference: PendingPromptReference
) {
  yield* Ref.set(webviewViewReference, Result.fail(WebviewNotShownError.make()));
  yield* answerPendingPrompt(pendingPromptReference, {_tag: PROMPT_ANSWER_TAGS.CANCELLED});
});

type SessionsViewServices =
  | Effect.Services<
      ReturnType<typeof attachWebviewView | typeof detachWebviewView | typeof handleWebviewMessage | typeof showPrompt>
    >
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
  pendingPromptReference: PendingPromptReference,
  runPromise: RunPromise
) {
  const vsCodeApi = yield* VsCodeApi;

  yield* acquireScopedDisposable(() =>
    vsCodeApi.window.registerWebviewViewProvider(SESSIONS_VIEW.ID, {
      resolveWebviewView: (webviewView) => {
        webviewView.webview.onDidReceiveMessage((webviewMessage) =>
          runPromise(handleWebviewMessage(webviewView, pendingPromptReference, webviewMessage))
        );
        webviewView.onDidDispose(() => runPromise(detachWebviewView(webviewViewReference, pendingPromptReference)));

        return runPromise(attachWebviewView(webviewViewReference, webviewView));
      }
    })
  );
});

const registerPromptCommand = Effect.fn("SessionsView.registerPromptCommand")(function* (
  webviewViewReference: WebviewViewReference,
  pendingPromptReference: PendingPromptReference,
  runPromise: RunPromise
) {
  const vsCodeApi = yield* VsCodeApi;

  yield* acquireScopedDisposable(() =>
    vsCodeApi.commands.registerCommand(SESSIONS_VIEW.SHOW_PROMPT_COMMAND, (promptArgument: unknown) =>
      runPromise(showPrompt(webviewViewReference, pendingPromptReference, promptArgument))
    )
  );
});

const watchAppearanceChanges = Effect.fn("SessionsView.watchAppearanceChanges")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const configChanges = yield* streamVsCodeEvent(vsCodeApi.workspace.onDidChangeConfiguration);

  return Stream.filter(
    configChanges,
    (configChange) =>
      configChange.affectsConfiguration(`${SETTINGS_SECTION}.${SESSIONS_VIEW_SETTINGS.FONT_SIZE}`) ||
      configChange.affectsConfiguration(`${SETTINGS_SECTION}.${SESSIONS_VIEW_SETTINGS.ACCENT_COLOR}`)
  );
});

const makeSessionsView = Effect.fn("SessionsView.make")(function* () {
  const webviewViewReference = yield* Ref.make<Result.Result<WebviewView, WebviewNotShownError>>(
    Result.fail(WebviewNotShownError.make())
  );
  const pendingPromptReference = yield* Ref.make<Result.Result<PendingPrompt, NoPendingPromptError>>(
    Result.fail(NoPendingPromptError.make())
  );
  const runPromise = yield* makeRunPromise();
  yield* registerWebviewViewProvider(webviewViewReference, pendingPromptReference, runPromise);
  yield* registerPromptCommand(webviewViewReference, pendingPromptReference, runPromise);
  const sessionListChanges = yield* watchSessionListChangesForSessionsView();
  const viewedSessionIds = yield* watchViewedSessionIdsForSessionsView();

  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      Effect.andThen(drawChange(webviewViewReference, sessionListChange), updateWaitingCounts(webviewViewReference))
    )
  );
  yield* Effect.forkScoped(Stream.runForEach(viewedSessionIds, () => drawViewedSessionChange(webviewViewReference)));
  const appearanceChanges = yield* watchAppearanceChanges();
  yield* Effect.forkScoped(Stream.runForEach(appearanceChanges, () => drawAppearanceChange(webviewViewReference)));
});

export const SessionsView = Layer.effectDiscard(makeSessionsView());
