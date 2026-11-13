import {listAgentsForSessionsView} from "@controllers/agent.controller.ts";
import {
  findViewedSessionIdForSessionsView,
  getSessionListItemForSessionsView,
  listProjectSessionsForSessionsView,
  listProjectsWithArchivedSessionsForSessionsView,
  listProjectsWithSessionsForSessionsView,
  listSessionsWaitingOnUserForSessionsView
} from "@controllers/session.controller.ts";
import {AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_VIEW_SETTINGS,
  STATUS_LABELS,
  VIEW_BADGE_LABELS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {getAgentIconUri, makeIconWebviewUri} from "@views/sessions/sessionsPage.utils.ts";
import {Array, Effect, Match, Schema} from "effect";

import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectSessionsDto, SessionListChangeDto, SessionListItemDto} from "@dtos/session.dto.ts";
import type {
  AgentRowData,
  ProjectRowData,
  SessionRowData,
  SessionsViewMessage
} from "@views/sessions/sessions.view.type.ts";
import type {Webview, WebviewView} from "vscode";

const FontSizeSettingSchema = Schema.Finite.check(Schema.isBetween({maximum: 24, minimum: 10}));

const AccentColorSettingSchema = Schema.String.check(Schema.isPattern(SESSIONS_VIEW_SETTINGS.ACCENT_COLOR_PATTERN));

// A webview that isn't listening yet drops the message, and asks for everything once it listens.
const postToWebview = Effect.fn("SessionsView.postToWebview")(function* (
  webviewView: WebviewView,
  sessionsViewMessage: SessionsViewMessage
) {
  yield* Effect.promise(() => webviewView.webview.postMessage(sessionsViewMessage));
});

const toSessionRow = Effect.fn("SessionsView.toSessionRow")(function* (
  webview: Webview,
  sessionListItem: SessionListItemDto
) {
  const sessionRow: SessionRowData = {...(yield* getAgentIconUri(webview, sessionListItem)), sessionListItem};

  return sessionRow;
});

const toProjectRow = Effect.fn("SessionsView.toProjectRow")(function* (
  webview: Webview,
  projectSessions: ProjectSessionsDto
) {
  const projectRow: ProjectRowData = {
    projectListItem: projectSessions.projectListItem,
    sessionRows: yield* Effect.forEach(projectSessions.sessionListItems, (sessionListItem) =>
      toSessionRow(webview, sessionListItem)
    )
  };

  return projectRow;
});

const drawAllProjects = Effect.fn("SessionsView.drawAllProjects")(function* (webviewView: WebviewView) {
  const projectsWithSessions = yield* listProjectsWithSessionsForSessionsView();
  const projectRows = yield* Effect.forEach(projectsWithSessions, (projectSessions) =>
    toProjectRow(webviewView.webview, projectSessions)
  );

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN, projectRows});
});

// The Archive is small, so any change but a session's own redraws it whole.
const drawArchive = Effect.fn("SessionsView.drawArchive")(function* (webviewView: WebviewView) {
  const projectsWithArchivedSessions = yield* listProjectsWithArchivedSessionsForSessionsView();
  const projectRows = yield* Effect.forEach(projectsWithArchivedSessions, (projectSessions) =>
    toProjectRow(webviewView.webview, projectSessions)
  );

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.ARCHIVE_DRAWN, projectRows});
});

const drawProjectSessions = Effect.fn("SessionsView.drawProjectSessions")(function* (
  webviewView: WebviewView,
  projectPath: string
) {
  const sessionListItems = yield* listProjectSessionsForSessionsView(projectPath);
  const sessionRows = yield* Effect.forEach(sessionListItems, (sessionListItem) =>
    toSessionRow(webviewView.webview, sessionListItem)
  );

  yield* postToWebview(webviewView, {
    _tag: SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN,
    projectPath,
    sessionRows
  });
});

// A session removed meanwhile draws nothing: the change that removed it redraws its project.
const drawSession = Effect.fn("SessionsView.drawSession")(
  function* (webviewView: WebviewView, sessionId: string) {
    const sessionListItem = yield* getSessionListItemForSessionsView(sessionId);
    const sessionRow = yield* toSessionRow(webviewView.webview, sessionListItem);

    yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN, sessionRow});
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

export const drawChange = Effect.fn("SessionsView.drawChange")(function* (
  webviewView: WebviewView,
  sessionListChange: SessionListChangeDto
) {
  yield* Match.valueTags(sessionListChange, {
    ProjectListChanged: () => Effect.andThen(drawAllProjects(webviewView), drawArchive(webviewView)),
    ProjectSessionsChanged: (projectSessionsChanged) =>
      Effect.andThen(drawProjectSessions(webviewView, projectSessionsChanged.projectPath), drawArchive(webviewView)),
    SessionChanged: (sessionChanged) => drawSession(webviewView, sessionChanged.sessionId)
  });
});

// With no session in front, the last one keeps its mark.
export const drawViewedSession = Effect.fn("SessionsView.drawViewedSession")(
  function* (webviewView: WebviewView) {
    const viewedSessionId = yield* findViewedSessionIdForSessionsView();

    yield* postToWebview(webviewView, {
      _tag: SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED,
      sessionId: viewedSessionId
    });
  },
  Effect.catchTag("NoViewedSessionError", () => Effect.void)
);

const countViewSessionsWaitingOnUser = Effect.fn("SessionsView.countViewSessionsWaitingOnUser")(function* (
  sessionsWaitingOnUser: readonly SessionListItemDto[],
  isArchiveView: boolean
) {
  return Array.filter(
    sessionsWaitingOnUser,
    (sessionWaitingOnUser) => sessionWaitingOnUser.isArchived === isArchiveView
  ).length;
});

// VS Code shows the view's badge on the activity bar too.
export const drawWaitingCounts = Effect.fn("SessionsView.drawWaitingCounts")(function* (webviewView: WebviewView) {
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

export const drawAppearance = Effect.fn("SessionsView.drawAppearance")(function* (webviewView: WebviewView) {
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

const toAgentRow = Effect.fn("SessionsView.toAgentRow")(function* (webview: Webview, agentListItem: AgentListItemDto) {
  const agentRow: AgentRowData = {agentListItem, iconUri: yield* makeIconWebviewUri(webview, agentListItem.icon)};

  return agentRow;
});

export const drawAgents = Effect.fn("SessionsView.drawAgents")(function* (webviewView: WebviewView) {
  const vsCodeApi = yield* VsCodeApi;
  const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
  const skipAgentPicker = yield* Effect.orElseSucceed(
    Schema.decodeUnknownEffect(Schema.Boolean)(configuredSettings.get(AGENT_SETTINGS.SKIP_AGENT_PICKER)),
    () => false
  );
  const agentListItems = yield* listAgentsForSessionsView();
  const agentRows = yield* Effect.forEach(agentListItems, (agentListItem) =>
    toAgentRow(webviewView.webview, agentListItem)
  );

  yield* postToWebview(webviewView, {_tag: SESSIONS_VIEW_MESSAGE_TAGS.AGENTS_DRAWN, agentRows, skipAgentPicker});
});

// The look first, so the rows draw in it.
export const drawEverything = Effect.fn("SessionsView.drawEverything")(function* (webviewView: WebviewView) {
  yield* drawAppearance(webviewView);
  yield* drawAgents(webviewView);
  yield* drawAllProjects(webviewView);
  yield* drawArchive(webviewView);
  yield* drawViewedSession(webviewView);
  yield* Effect.ignore(drawWaitingCounts(webviewView), {
    log: "Debug",
    message: "Could not draw the Sessions view's counts"
  });
});
