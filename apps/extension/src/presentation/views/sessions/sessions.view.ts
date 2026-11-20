import {SessionController} from "@controllers/session.controller.ts";
import {SessionProcessController} from "@controllers/sessionProcess.controller.ts";
import {AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {
  SESSION_LISTS,
  SESSIONS_VIEW,
  SESSIONS_VIEW_SETTINGS,
  SESSIONS_WEBVIEW_COMMANDS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {SessionsDrawingUtils} from "@views/sessions/sessionsDrawing.utils.ts";
import {SessionsPageUtils} from "@views/sessions/sessionsPage.utils.ts";
import {Array, Context, Effect, Layer, Match, Schema, Stream, SubscriptionRef} from "effect";

import type {SessionListChangeDto} from "@dtos/session.dto.ts";
import type {SessionProcessesDto} from "@dtos/sessionProcess.dto.ts";
import type {CommandRequest, OpenDropdownSessionIds} from "@views/sessions/sessions.view.type.ts";
import type {WebviewView} from "vscode";

class SessionsViewErrors extends TaggedErrors({
  RowCommandFailedError: {cause: Schema.Unknown, commandId: Schema.String}
}) {}

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

export class SessionsView extends Context.Service<SessionsView>()(
  "aggregor-app/presentation/views/sessions/sessions.view/SessionsView",
  {
    make: Effect.fn("make")(function* () {
      const sessionController = yield* SessionController;
      const sessionProcessController = yield* SessionProcessController;
      const sessionsDrawingUtils = yield* SessionsDrawingUtils;
      const sessionsPageUtils = yield* SessionsPageUtils;
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const openDropdownSessionIds: OpenDropdownSessionIds = yield* SubscriptionRef.make<readonly string[]>([]);

      const redrawChange = Effect.fn("redrawChange")(
        function* (sessionListChange: SessionListChangeDto) {
          yield* sessionsDrawingUtils.drawChange(sessionListChange);
        },
        Effect.catchTag("WebviewNotShownError", () => Effect.void),
        Effect.catch((drawError) => Effect.logWarning("Could not redraw the Sessions view", drawError))
      );

      const redrawSessionProcesses = Effect.fn("redrawSessionProcesses")(
        function* (sessionProcesses: SessionProcessesDto) {
          yield* sessionsDrawingUtils.drawSessionProcesses(sessionProcesses);
        },
        Effect.catchTag("WebviewNotShownError", () => Effect.void)
      );

      const redrawViewedSession = Effect.fn("redrawViewedSession")(
        function* () {
          yield* sessionsDrawingUtils.drawViewedSession;
        },
        Effect.catchTag("WebviewNotShownError", () => Effect.void)
      );

      const runRowCommand = Effect.fn("runRowCommand")(function* (
        commandId: string,
        commandArgument: CommandRequest | undefined
      ) {
        const commandArguments = commandArgument === undefined ? [] : [commandArgument];
        yield* Effect.annotateCurrentSpan({commandId});

        yield* Effect.tryPromise({
          catch: (cause) => SessionsViewErrors.RowCommandFailedError.make({cause, commandId}),
          try: () => vsCodeApi.commands.executeCommand(commandId, ...commandArguments)
        });
      });

      // Until VS Code first shows the view there are no counts to draw, and a failed read leaves them as they were.
      const updateWaitingCounts = Effect.fn("updateWaitingCounts")(
        function* () {
          yield* sessionsDrawingUtils.drawWaitingCounts;
        },
        Effect.ignore({log: "Debug", message: "Could not update the Sessions view's badge and counts"})
      );

      const redrawAppearance = Effect.fn("redrawAppearance")(
        function* () {
          yield* sessionsDrawingUtils.drawAppearance;
        },
        Effect.catchTag("WebviewNotShownError", () => Effect.void)
      );

      const redrawAgents = Effect.fn("redrawAgents")(
        function* () {
          yield* sessionsDrawingUtils.drawAgents;
        },
        Effect.catchTag("WebviewNotShownError", () => Effect.void),
        Effect.catch((drawError) => Effect.logWarning("Could not redraw the Sessions view's agents", drawError))
      );

      const handleWebviewMessage = Effect.fn("handleWebviewMessage", {root: true})(
        function* (webviewMessage: unknown) {
          const sessionsWebviewMessage = yield* vscodeUtils.decodeVsCodeArgument(
            SessionsWebviewMessageSchema,
            webviewMessage
          );

          yield* Match.valueTags(sessionsWebviewMessage, {
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_BRANCHES]: (listBranches) =>
              sessionsDrawingUtils.drawBranches(listBranches.projectPath),
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_IMPORTABLE_SESSIONS]: (listImportableSessions) =>
              sessionsDrawingUtils.drawImportableSessions(listImportableSessions.projectPath),
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_LEFTOVERS]: (listLeftovers) =>
              sessionsDrawingUtils.drawLeftovers(listLeftovers.projectPath),
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_PULL_REQUESTS]: (listPullRequests) =>
              sessionsDrawingUtils.drawPullRequests(listPullRequests.sessionId),
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.READY]: () => sessionsDrawingUtils.drawEverything,
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND]: (runCommand) =>
              runRowCommand(runCommand.commandId, runCommand.commandArgument),
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.SHOW_MORE_SESSIONS]: (showMoreSessions) =>
              sessionsDrawingUtils.drawMoreSessions(showMoreSessions),
            [SESSIONS_WEBVIEW_MESSAGE_TAGS.WATCH_SESSION_PROCESSES]: (watchSessionProcesses) =>
              SubscriptionRef.set(openDropdownSessionIds, watchSessionProcesses.sessionIds)
          });
        },
        Effect.catch((messageError) => Effect.logWarning("Could not answer the Sessions view's webview", messageError))
      );

      const attachWebviewView = Effect.fn("attachWebviewView")(function* (webviewView: WebviewView) {
        yield* sessionsPageUtils.setUpWebviewOptions(webviewView.webview);
        const webviewHtml = yield* sessionsPageUtils.makeWebviewHtml(webviewView.webview);
        yield* Effect.sync(() => {
          webviewView.webview.html = webviewHtml;
        });
        yield* sessionsDrawingUtils.setShownWebviewView(webviewView);
        yield* updateWaitingCounts();
      });

      const detachWebviewView = Effect.fn("detachWebviewView")(function* () {
        yield* sessionsDrawingUtils.clearShownWebviewView;
        yield* SubscriptionRef.set(openDropdownSessionIds, []);
      });

      const makeRunPromise = Effect.fn("makeRunPromise")(function* () {
        const sessionsViewContext = yield* Effect.context();
        const runPromise = Effect.runPromiseWith(sessionsViewContext);

        return runPromise;
      });

      // VS Code disposes the webview's events with it.
      const registerWebviewViewProvider = Effect.fn("registerWebviewViewProvider")(function* () {
        const runPromise = yield* makeRunPromise();

        yield* vscodeUtils.acquireScopedDisposable(() =>
          vsCodeApi.window.registerWebviewViewProvider(SESSIONS_VIEW.ID, {
            resolveWebviewView: (webviewView) => {
              webviewView.webview.onDidReceiveMessage((webviewMessage) =>
                runPromise(handleWebviewMessage(webviewMessage))
              );
              webviewView.onDidDispose(() => runPromise(detachWebviewView()));

              return runPromise(attachWebviewView(webviewView));
            }
          })
        );
      });

      const watchSettingChanges = Effect.fn("watchSettingChanges")(function* (settingKeys: readonly string[]) {
        const configChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.workspace.onDidChangeConfiguration);

        return Stream.filter(configChanges, (configChange) =>
          Array.some(settingKeys, (settingKey) =>
            configChange.affectsConfiguration(`${SETTINGS_SECTION}.${settingKey}`)
          )
        );
      });

      // Polled every 2 seconds, so its redraws go untraced.
      const startSessionProcessRedraws = Effect.fn("startSessionProcessRedraws")(function* () {
        const sessionProcessReadings = yield* sessionProcessController.watchSessionProcessesForSessionsView(
          SubscriptionRef.changes(openDropdownSessionIds)
        );

        yield* Effect.forkScoped(
          Stream.runForEach(sessionProcessReadings, (sessionProcesses) =>
            Effect.withTracerEnabled(redrawSessionProcesses(sessionProcesses), false)
          )
        );
      });

      const startSettingRedraws = Effect.fn("startSettingRedraws")(function* () {
        const appearanceChanges = yield* watchSettingChanges([
          SESSIONS_VIEW_SETTINGS.FONT_SIZE,
          SESSIONS_VIEW_SETTINGS.ACCENT_COLOR
        ]);
        const agentSettingChanges = yield* watchSettingChanges([
          AGENT_SETTINGS.AGENTS,
          AGENT_SETTINGS.DEFAULT_AGENT,
          AGENT_SETTINGS.SKIP_AGENT_PICKER
        ]);

        yield* Effect.forkScoped(Stream.runForEach(appearanceChanges, () => redrawAppearance()));
        yield* Effect.forkScoped(Stream.runForEach(agentSettingChanges, () => redrawAgents()));
      });

      yield* registerWebviewViewProvider();
      const sessionListChanges = yield* sessionController.watchSessionListChangesForSessionsView;
      const viewedSessionIds = yield* sessionController.watchViewedSessionIdsForSessionsView;

      yield* Effect.forkScoped(
        Stream.runForEach(sessionListChanges, (sessionListChange) =>
          Effect.andThen(redrawChange(sessionListChange), updateWaitingCounts())
        )
      );
      yield* Effect.forkScoped(Stream.runForEach(viewedSessionIds, () => redrawViewedSession()));
      yield* startSessionProcessRedraws();
      yield* startSettingRedraws();

      return {};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionsView", this.make())).pipe(
    Layer.provide([
      SessionController.layer,
      SessionProcessController.layer,
      SessionsDrawingUtils.layer,
      SessionsPageUtils.layer
    ])
  );
}
