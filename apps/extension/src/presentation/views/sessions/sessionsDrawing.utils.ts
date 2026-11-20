import {AgentController} from "@controllers/agent.controller.ts";
import {PullRequestController} from "@controllers/pullRequest.controller.ts";
import {SessionController} from "@controllers/session.controller.ts";
import {SessionImportController} from "@controllers/sessionImport.controller.ts";
import {WorktreeController} from "@controllers/worktree.controller.ts";
import {AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {SESSION_PAGES} from "@pkg/constants/src/session.constant.ts";
import {
  SESSION_LISTS,
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_VIEW_SETTINGS,
  STATUS_LABELS,
  VIEW_BADGE_LABELS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {WORKSPACE_TRUST_SETTINGS} from "@pkg/constants/src/vscode.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {SessionsPageUtils} from "@views/sessions/sessionsPage.utils.ts";
import {Array, Context, Effect, Layer, Match, Ref, Result, Schema, Stream} from "effect";

import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectSessionsDto, SessionListChangeDto, SessionListItemDto} from "@dtos/session.dto.ts";
import type {SessionProcessesDto} from "@dtos/sessionProcess.dto.ts";
import type {
  AgentRowData,
  ProjectRowData,
  SessionListId,
  SessionRowData,
  SessionsViewMessage,
  ShownSessionPages
} from "@views/sessions/sessions.view.type.ts";
import type {WebviewView} from "vscode";

class SessionsDrawingUtilsErrors extends TaggedErrors({
  WebviewNotShownError: {}
}) {}

const FontSizeSettingSchema = Schema.Finite.check(Schema.isBetween({maximum: 24, minimum: 10}));

const AccentColorSettingSchema = Schema.String.check(Schema.isPattern(SESSIONS_VIEW_SETTINGS.ACCENT_COLOR_PATTERN));

export class SessionsDrawingUtils extends Context.Service<SessionsDrawingUtils>()(
  "aggregor-app/presentation/views/sessions/sessionsDrawing.utils/SessionsDrawingUtils",
  {
    make: Effect.fn("make")(function* () {
      const agentController = yield* AgentController;
      const pullRequestController = yield* PullRequestController;
      const sessionController = yield* SessionController;
      const sessionImportController = yield* SessionImportController;
      const worktreeController = yield* WorktreeController;
      const sessionsPageUtils = yield* SessionsPageUtils;
      const vsCodeApi = yield* VsCodeApi;
      const webviewViewReference = yield* Ref.make<
        Result.Result<WebviewView, SessionsDrawingUtilsErrors["WebviewNotShownError"]>
      >(Result.fail(SessionsDrawingUtilsErrors.WebviewNotShownError.make()));
      // Kept for the window's life, so a list keeps the pages it showed when VS Code shows the view again.
      const shownSessionPages: ShownSessionPages = yield* Ref.make({
        [SESSION_LISTS.ARCHIVE]: {},
        [SESSION_LISTS.SESSIONS]: {}
      });

      const setShownWebviewView = Effect.fn("setShownWebviewView")(function* (webviewView: WebviewView) {
        yield* Ref.set(webviewViewReference, Result.succeed(webviewView));
      });

      const clearShownWebviewView = Effect.fn("clearShownWebviewView")(function* () {
        yield* Ref.set(webviewViewReference, Result.fail(SessionsDrawingUtilsErrors.WebviewNotShownError.make()));
      });

      const findShownWebviewView = Effect.fn("findShownWebviewView")(function* () {
        const webviewViewResult = yield* Ref.get(webviewViewReference);

        return yield* Effect.fromResult(webviewViewResult);
      });

      // A webview that isn't listening yet drops the message, and asks for everything once it listens.
      const postToWebview = Effect.fn("postToWebview")(function* (sessionsViewMessage: SessionsViewMessage) {
        const webviewView = yield* findShownWebviewView();

        yield* Effect.promise(() => webviewView.webview.postMessage(sessionsViewMessage));
      });

      const makeSessionRow = Effect.fn("makeSessionRow")(function* (sessionListItem: SessionListItemDto) {
        const webviewView = yield* findShownWebviewView();
        const sessionRow: SessionRowData = {
          ...(yield* sessionsPageUtils.getAgentIconUri(webviewView.webview, sessionListItem)),
          sessionListItem
        };

        return sessionRow;
      });

      const makeProjectRow = Effect.fn("makeProjectRow")(function* (projectSessions: ProjectSessionsDto) {
        const projectRow: ProjectRowData = {
          ...(projectSessions.hasLeftovers === undefined ? {} : {hasLeftovers: projectSessions.hasLeftovers}),
          ...(projectSessions.worktrees === undefined ? {} : {worktrees: projectSessions.worktrees}),
          ...(projectSessions.worktreesRootPath === undefined
            ? {}
            : {worktreesRootPath: projectSessions.worktreesRootPath}),
          projectListItem: projectSessions.projectListItem,
          sessionPage: projectSessions.sessionPage,
          sessionRows: yield* Effect.forEach(projectSessions.sessionListItems, (sessionListItem) =>
            makeSessionRow(sessionListItem)
          )
        };

        return projectRow;
      });

      const findShownPageCount = Effect.fn("findShownPageCount")(function* (projectPath: string) {
        const shownPageCounts = yield* Ref.get(shownSessionPages);
        const shownPageCount = shownPageCounts[SESSION_LISTS.SESSIONS][projectPath];

        return shownPageCount === undefined ? SESSION_PAGES.FIRST_PAGE_COUNT : shownPageCount;
      });

      const drawAllProjects = Effect.fn("drawAllProjects")(function* () {
        const shownPageCounts = yield* Ref.get(shownSessionPages);
        const projectsWithSessions = yield* sessionController.listProjectsWithSessionsForSessionsView(
          shownPageCounts[SESSION_LISTS.SESSIONS]
        );
        const projectRows = yield* Effect.forEach(projectsWithSessions, (projectSessions) =>
          makeProjectRow(projectSessions)
        );

        yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN, projectRows});
      });

      const drawArchive = Effect.fn("drawArchive")(function* () {
        const shownPageCounts = yield* Ref.get(shownSessionPages);
        const projectsWithArchivedSessions = yield* sessionController.listProjectsWithArchivedSessionsForSessionsView(
          shownPageCounts[SESSION_LISTS.ARCHIVE]
        );
        const projectRows = yield* Effect.forEach(projectsWithArchivedSessions, (projectSessions) =>
          makeProjectRow(projectSessions)
        );

        yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.ARCHIVE_DRAWN, projectRows});
      });

      const drawProject = Effect.fn("drawProject")(
        function* (projectPath: string) {
          const shownPageCount = yield* findShownPageCount(projectPath);
          const projectSessions = yield* sessionController.getProjectSessionsForSessionsView(
            projectPath,
            shownPageCount
          );
          const projectRow = yield* makeProjectRow(projectSessions);

          yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_DRAWN, projectRow});
        },
        Effect.catchTag("ProjectNotListedError", () => Effect.void)
      );

      const drawMoreSessions = Effect.fn("drawMoreSessions")(function* (moreSessionsRequest: {
        readonly listId: SessionListId;
        readonly projectPath: string;
      }) {
        yield* Ref.update(shownSessionPages, (shownPageCounts) => {
          const listPageCounts = shownPageCounts[moreSessionsRequest.listId];
          const shownPageCount = listPageCounts[moreSessionsRequest.projectPath];
          const nextPageCount = (shownPageCount === undefined ? SESSION_PAGES.FIRST_PAGE_COUNT : shownPageCount) + 1;

          return {
            ...shownPageCounts,
            [moreSessionsRequest.listId]: {...listPageCounts, [moreSessionsRequest.projectPath]: nextPageCount}
          };
        });
        yield* moreSessionsRequest.listId === SESSION_LISTS.ARCHIVE
          ? drawArchive()
          : drawProject(moreSessionsRequest.projectPath);
      });

      const drawImportableSessions = Effect.fn("drawImportableSessions")(
        function* (projectPath: string) {
          const importableSessions = yield* sessionImportController.listImportableSessionsForSessionsView(projectPath);

          yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.IMPORTABLE_SESSIONS_DRAWN, importableSessions});
        },
        Effect.catch((importError) =>
          Effect.logWarning("Could not list the project's importable sessions", importError)
        )
      );

      const drawLeftovers = Effect.fn("drawLeftovers")(
        function* (projectPath: string) {
          const leftovers = yield* worktreeController.listProjectLeftoversForSessionsView(projectPath);

          yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.LEFTOVERS_DRAWN, leftovers});
        },
        Effect.catch((leftoversError) => Effect.logWarning("Could not list the project's leftovers", leftoversError))
      );

      const drawBranches = Effect.fn("drawBranches")(
        function* (projectPath: string) {
          const projectBranches = yield* worktreeController.listProjectBranchesForSessionsView(projectPath);

          yield* Stream.runForEach(projectBranches, (branches) =>
            postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.BRANCHES_DRAWN, branches})
          );
        },
        Effect.catch((branchesError) => Effect.logWarning("Could not list the project's branches", branchesError))
      );

      const drawPullRequests = Effect.fn("drawPullRequests")(
        function* (sessionId: string) {
          const pullRequests = yield* pullRequestController.listSessionPullRequestsForSessionsView(sessionId);

          yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.PULL_REQUESTS_DRAWN, pullRequests});
        },
        Effect.catch((pullRequestsError) =>
          Effect.logWarning("Could not list the session's pull requests", pullRequestsError)
        )
      );

      const drawSession = Effect.fn("drawSession")(
        function* (sessionId: string) {
          const sessionListItem = yield* sessionController.getSessionListItemForSessionsView(sessionId);
          const sessionRow = yield* makeSessionRow(sessionListItem);

          yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN, sessionRow});
        },
        Effect.catchTag("SessionNotFoundError", () => Effect.void)
      );

      const drawChange = Effect.fn("drawChange")(function* (sessionListChange: SessionListChangeDto) {
        yield* Match.valueTags(sessionListChange, {
          ProjectListChanged: () => Effect.andThen(drawAllProjects(), drawArchive()),
          ProjectSessionsChanged: (projectSessionsChanged) =>
            Effect.andThen(drawProject(projectSessionsChanged.projectPath), drawArchive()),
          SessionChanged: (sessionChanged) => drawSession(sessionChanged.sessionId)
        });
      });

      const drawSessionProcesses = Effect.fn("drawSessionProcesses")(function* (sessionProcesses: SessionProcessesDto) {
        yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.SESSION_PROCESSES_DRAWN, sessionProcesses});
      });

      const drawViewedSession = Effect.fn("drawViewedSession")(
        function* () {
          const viewedSessionId = yield* sessionController.findViewedSessionIdForSessionsView;

          yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED, sessionId: viewedSessionId});
        },
        Effect.catchTag("NoViewedSessionError", () => Effect.void)
      );

      const countViewSessionsWaitingOnUser = Effect.fn("countViewSessionsWaitingOnUser")(function* (
        sessionsWaitingOnUser: readonly SessionListItemDto[],
        isArchiveView: boolean
      ) {
        return Array.filter(
          sessionsWaitingOnUser,
          (sessionWaitingOnUser) => sessionWaitingOnUser.isArchived === isArchiveView
        ).length;
      });

      // VS Code shows the view's badge on the activity bar too.
      const drawWaitingCounts = Effect.fn("drawWaitingCounts")(function* () {
        const webviewView = yield* findShownWebviewView();
        const sessionsWaitingOnUser = yield* sessionController.listSessionsWaitingOnUserForSessionsView;
        const tooltipLines = Array.map(sessionsWaitingOnUser, (sessionWaitingOnUser) =>
          VIEW_BADGE_LABELS.TOOLTIP_LINE(sessionWaitingOnUser.displayName, STATUS_LABELS[sessionWaitingOnUser.status])
        );
        const sessionsWaitingCount = yield* countViewSessionsWaitingOnUser(sessionsWaitingOnUser, false);
        const archiveWaitingCount = yield* countViewSessionsWaitingOnUser(sessionsWaitingOnUser, true);

        yield* Effect.sync(() => {
          webviewView.badge =
            tooltipLines.length === 0
              ? undefined
              : {tooltip: Array.join(tooltipLines, "\n"), value: tooltipLines.length};
        });
        yield* postToWebview({
          _tag: SESSIONS_VIEW_MESSAGE_TAGS.WAITING_COUNTS_DRAWN,
          archiveWaitingCount,
          sessionsWaitingCount
        });
      });

      const drawAppearance = Effect.fn("drawAppearance")(function* () {
        const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
        const fontSize = yield* Effect.orElseSucceed(
          Schema.decodeUnknownEffect(FontSizeSettingSchema)(configuredSettings.get(SESSIONS_VIEW_SETTINGS.FONT_SIZE)),
          () => SESSIONS_VIEW_SETTINGS.DEFAULT_FONT_SIZE
        );
        const accentColor = yield* Effect.orElseSucceed(
          Schema.decodeUnknownEffect(AccentColorSettingSchema)(
            configuredSettings.get(SESSIONS_VIEW_SETTINGS.ACCENT_COLOR)
          ),
          () => SESSIONS_VIEW_SETTINGS.DEFAULT_ACCENT_COLOR
        );

        yield* postToWebview({_tag: SESSIONS_VIEW_MESSAGE_TAGS.APPEARANCE_DRAWN, accentColor, fontSize});
      });

      const makeAgentRow = Effect.fn("makeAgentRow")(function* (agentListItem: AgentListItemDto) {
        const webviewView = yield* findShownWebviewView();
        const agentRow: AgentRowData = {
          agentListItem,
          iconUri: yield* sessionsPageUtils.makeIconWebviewUri(webviewView.webview, agentListItem.icon)
        };

        return agentRow;
      });

      // VS Code's own default turns trust on.
      const readWorkspaceTrustEnabled = Effect.fn("readWorkspaceTrustEnabled")(function* () {
        const trustSettings = yield* vsCodeApi.getConfiguration(WORKSPACE_TRUST_SETTINGS.SECTION);

        return yield* Effect.orElseSucceed(
          Schema.decodeUnknownEffect(Schema.Boolean)(trustSettings.get(WORKSPACE_TRUST_SETTINGS.ENABLED)),
          () => true
        );
      });

      const drawAgents = Effect.fn("drawAgents")(function* () {
        const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
        const skipAgentPicker = yield* Effect.orElseSucceed(
          Schema.decodeUnknownEffect(Schema.Boolean)(configuredSettings.get(AGENT_SETTINGS.SKIP_AGENT_PICKER)),
          () => false
        );
        const agentListItems = yield* agentController.listAgentsForSessionsView;
        const agentRows = yield* Effect.forEach(agentListItems, (agentListItem) => makeAgentRow(agentListItem));

        yield* postToWebview({
          _tag: SESSIONS_VIEW_MESSAGE_TAGS.AGENTS_DRAWN,
          agentRows,
          isWorkspaceTrustEnabled: yield* readWorkspaceTrustEnabled(),
          skipAgentPicker
        });
      });

      // The look first, so the rows draw in it.
      const drawEverything = Effect.fn("drawEverything")(function* () {
        yield* drawAppearance();
        yield* drawAgents();
        yield* drawAllProjects();
        yield* drawArchive();
        yield* drawViewedSession();
        yield* Effect.ignore(drawWaitingCounts(), {
          log: "Debug",
          message: "Could not draw the Sessions view's counts"
        });
      });

      return {
        clearShownWebviewView: clearShownWebviewView(),
        drawAgents: drawAgents(),
        drawAppearance: drawAppearance(),
        drawBranches,
        drawChange,
        drawEverything: drawEverything(),
        drawImportableSessions,
        drawLeftovers,
        drawMoreSessions,
        drawPullRequests,
        drawSessionProcesses,
        drawViewedSession: drawViewedSession(),
        drawWaitingCounts: drawWaitingCounts(),
        setShownWebviewView
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionsDrawingUtils", this.make())).pipe(
    Layer.provide([
      AgentController.layer,
      PullRequestController.layer,
      SessionController.layer,
      SessionImportController.layer,
      WorktreeController.layer,
      SessionsPageUtils.layer
    ])
  );
}
