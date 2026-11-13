import {listProjectsForSessionsView} from "@controllers/project.controller.ts";
import {
  findViewedSessionIdForSessionsView,
  getSessionListItemForSessionsView,
  listProjectSessionIdsForSessionsView,
  listSessionsWaitingOnUserForSessionsView,
  watchSessionListChangesForSessionsView,
  watchViewedSessionIdsForSessionsView
} from "@controllers/session.controller.ts";
import {
  SESSIONS_VIEW,
  SESSIONS_VIEW_LABELS,
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_WEBVIEW_COMMANDS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS,
  STATUS_LABELS,
  VIEW_BADGE_LABELS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable} from "@pkg/vscode/src/vscode.utils.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {makeProjectNodeId, makeSessionNodeId} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  countViewSessionsWaitingOnUser,
  getAgentIconUri,
  makeWebviewHtml,
  setUpWebviewOptions
} from "@views/sessions/sessions.utils.ts";
import {Array, Effect, Layer, Match, Ref, Result, Schema, Stream} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {ProjectRowData, SessionRowData, SessionsViewMessage} from "@views/sessions/sessions.view.type.ts";
import type {WebviewView} from "vscode";

// The Sessions view is a webview that apps/webview draws. The view reads the projects and sessions through the
// controllers and sends them to the webview, then each change as it happens, and runs the commands the webview asks for,
// the same commands the menus run. The webview keeps the rows it was sent; the view keeps none.

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

// What the webview asks: to be drawn once its script listens, and to run one of the commands it may run on a row.
const SessionsWebviewMessageSchema = Schema.TaggedUnion({
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
  projectPath: string
) {
  const sessionIds = yield* listProjectSessionIdsForSessionsView(projectPath);
  const sessionRowLists = yield* Effect.forEach(sessionIds, (sessionId) =>
    readSessionRowIfFound(webviewView, sessionId)
  );

  return Array.flatten(sessionRowLists);
});

const readProjectRow = Effect.fn("SessionsView.readProjectRow")(function* (
  webviewView: WebviewView,
  projectListItem: ProjectListItemDto
) {
  const projectRow: ProjectRowData = {
    nodeId: yield* makeProjectNodeId(projectListItem.path),
    projectListItem,
    sessionRows: yield* readProjectSessionRows(webviewView, projectListItem.path)
  };

  return projectRow;
});

const drawAllProjects = Effect.fn("SessionsView.drawAllProjects")(function* (webviewView: WebviewView) {
  const projectListItems = yield* listProjectsForSessionsView();
  const projectRows = yield* Effect.forEach(projectListItems, (projectListItem) =>
    readProjectRow(webviewView, projectListItem)
  );

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN, projectRows});
});

const drawProjectSessions = Effect.fn("SessionsView.drawProjectSessions")(function* (
  webviewView: WebviewView,
  projectPath: string
) {
  const sessionRows = yield* readProjectSessionRows(webviewView, projectPath);

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

// The session in front gets its row marked; with none in front, the last one keeps it.
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

// Redraws only what changed: every project for the project list, one project's sessions, or one session.
const drawChange = Effect.fn("SessionsView.drawChange")(
  function* (webviewViewReference: WebviewViewReference, sessionListChange: SessionListChangeDto) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);

    yield* Match.valueTags(sessionListChange, {
      ProjectListChanged: () => drawAllProjects(webviewView),
      ProjectSessionsChanged: (projectSessionsChanged) =>
        drawProjectSessions(webviewView, projectSessionsChanged.projectPath),
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

// The webview asks once its script listens, which is again each time VS Code shows the view after hiding it.
const handleWebviewMessage = Effect.fn("SessionsView.handleWebviewMessage", {root: true})(
  function* (webviewView: WebviewView, webviewMessage: unknown) {
    const sessionsWebviewMessage = yield* decodeVsCodeArgument(SessionsWebviewMessageSchema, webviewMessage);

    yield* Match.valueTags(sessionsWebviewMessage, {
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: () =>
        Effect.andThen(drawAllProjects(webviewView), drawViewedSession(webviewView)),
      [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: (runCommand) =>
        runRowCommand(runCommand.commandId, runCommand.nodeId)
    });
  },
  Effect.catch((messageError) => Effect.logWarning("Could not answer the Sessions view's webview", messageError))
);

// The view's badge counts the sessions waiting on the user in both views, and VS Code shows it on the activity bar too;
// the count in the view's name, this view's. The name, not the description VS Code draws faded beside it: that one is
// hard to read and hidden while the view is collapsed. Until VS Code first shows the view there is neither, and a
// failed read leaves both as they were.
const updateWaitingCounts = Effect.fn("SessionsView.updateWaitingCounts")(
  function* (webviewViewReference: WebviewViewReference) {
    const webviewView = yield* findShownWebviewView(webviewViewReference);
    const sessionsWaitingOnUser = yield* listSessionsWaitingOnUserForSessionsView();
    const tooltipLines = Array.map(sessionsWaitingOnUser, (sessionWaitingOnUser) =>
      VIEW_BADGE_LABELS.TOOLTIP_LINE(sessionWaitingOnUser.displayName, STATUS_LABELS[sessionWaitingOnUser.status])
    );
    const waitingCount = yield* countViewSessionsWaitingOnUser(sessionsWaitingOnUser, false);

    yield* Effect.sync(() => {
      webviewView.badge =
        tooltipLines.length === 0 ? undefined : {tooltip: Array.join(tooltipLines, "\n"), value: tooltipLines.length};
      webviewView.title =
        waitingCount === 0 ? SESSIONS_VIEW_LABELS.TITLE : SESSIONS_VIEW_LABELS.TITLE_WITH_WAITING_COUNT(waitingCount);
    });
  },
  Effect.ignore({log: "Debug", message: "Could not update the Sessions view's badge and name"})
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

// What the webview's callbacks need to run.
type SessionsViewServices =
  | Effect.Services<ReturnType<typeof attachWebviewView | typeof detachWebviewView | typeof handleWebviewMessage>>
  | VsCodeApi;

type RunPromise = <A, E>(effect: Effect.Effect<A, E, SessionsViewServices>) => Promise<A>;

const makeRunPromise = Effect.fn("SessionsView.makeRunPromise")(function* () {
  const sessionsViewContext = yield* Effect.context<SessionsViewServices>();
  const runPromise: RunPromise = Effect.runPromiseWith(sessionsViewContext);

  return runPromise;
});

// The webview's page reloads each time VS Code shows the view after hiding it, and asks to be drawn again; VS Code
// disposes the webview's events with it.
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

// Registers the view for the lifetime of the runtime; disposing the runtime unregisters it.
const makeSessionsView = Effect.fn("SessionsView.make")(function* () {
  const webviewViewReference = yield* Ref.make<Result.Result<WebviewView, WebviewNotShownError>>(
    Result.fail(WebviewNotShownError.make())
  );
  const runPromise = yield* makeRunPromise();
  yield* registerWebviewViewProvider(webviewViewReference, runPromise);
  const sessionListChanges = yield* watchSessionListChangesForSessionsView();
  const viewedSessionIds = yield* watchViewedSessionIdsForSessionsView();

  yield* Effect.forkScoped(
    Stream.runForEach(sessionListChanges, (sessionListChange) =>
      Effect.andThen(drawChange(webviewViewReference, sessionListChange), updateWaitingCounts(webviewViewReference))
    )
  );
  yield* Effect.forkScoped(Stream.runForEach(viewedSessionIds, () => drawViewedSessionChange(webviewViewReference)));
});

export const SessionsView = Layer.effectDiscard(makeSessionsView());
