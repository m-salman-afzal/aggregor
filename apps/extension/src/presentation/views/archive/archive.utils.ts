import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {
  ROW_ICONS,
  SESSION_BADGE_URI_SCHEME,
  SESSION_ROW_LABELS,
  SESSIONS_VIEW_CONTEXT_VALUES,
  SPINNER_FRAME_INTERVAL_MS,
  STATUS_BADGES,
  STATUS_KIND_LABELS,
  STATUS_LABELS
} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {makeProjectNodeId, makeSessionNodeId} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {Array, Clock, Effect} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionListItemDto} from "@dtos/session.dto.ts";

// How the Archive tree draws what its controllers return: project and session rows, and session badges.

// The URI a session row's badge hangs off; the badge provider reads the session id back from its path.
export const getSessionBadgeUri = Effect.fn("ArchiveView.getSessionBadgeUri")(function* (sessionId: string) {
  const vsCodeApi = yield* VsCodeApi;

  return vsCodeApi.Uri.from({path: `/${sessionId}`, scheme: SESSION_BADGE_URI_SCHEME});
});

// The row's kind, then the ways it can move, then the state words given, which the manifest's menus match.
const makeRowContextValue = Effect.fn("ArchiveView.makeRowContextValue")(function* (
  rowKind: string,
  listItem: ProjectListItemDto | SessionListItemDto,
  stateWords: readonly string[]
) {
  const moveWords = [
    ...(listItem.canMoveUp ? [SESSIONS_VIEW_CONTEXT_VALUES.CAN_MOVE_UP] : []),
    ...(listItem.canMoveDown ? [SESSIONS_VIEW_CONTEXT_VALUES.CAN_MOVE_DOWN] : [])
  ];

  return Array.join([rowKind, ...moveWords, ...stateWords], " ");
});

// A session row also says whether its agent runs, for Stop Agent.
const makeSessionRowContextValue = Effect.fn("ArchiveView.makeSessionRowContextValue")(function* (
  sessionListItem: SessionListItemDto
) {
  return yield* makeRowContextValue(
    SESSIONS_VIEW_CONTEXT_VALUES.SESSION,
    sessionListItem,
    sessionListItem.isAgentRunning ? [SESSIONS_VIEW_CONTEXT_VALUES.AGENT_RUNNING] : []
  );
});

// The agent's image; a session whose agent is gone shows a warning.
const getSessionRowIcon = Effect.fn("ArchiveView.getSessionRowIcon")(function* (sessionListItem: SessionListItemDto) {
  const vsCodeApi = yield* VsCodeApi;

  return sessionListItem.icon === undefined
    ? new vsCodeApi.ThemeIcon(ROW_ICONS.MISSING_AGENT)
    : vsCodeApi.Uri.file(sessionListItem.icon);
});

// A blocked session says what it waits for, when its agent says.
const getStatusLabel = Effect.fn("ArchiveView.getStatusLabel")(function* (sessionListItem: SessionListItemDto) {
  return sessionListItem.statusKind === undefined
    ? STATUS_LABELS[sessionListItem.status]
    : STATUS_KIND_LABELS[sessionListItem.statusKind];
});

// The agent's message, such as the permission it asks for, sits between the name and the folder.
const makeSessionRowTooltip = Effect.fn("ArchiveView.makeSessionRowTooltip")(function* (
  sessionListItem: SessionListItemDto,
  statusLabel: string
) {
  const statusMessageLines = sessionListItem.statusMessage === undefined ? [] : [sessionListItem.statusMessage];

  return Array.join(
    [
      SESSION_ROW_LABELS.TOOLTIP_HEADING(sessionListItem.name, statusLabel),
      ...statusMessageLines,
      sessionListItem.projectPath
    ],
    "\n"
  );
});

export const createSessionTreeItem = Effect.fn("ArchiveView.createSessionTreeItem")(function* (
  sessionListItem: SessionListItemDto
) {
  const vsCodeApi = yield* VsCodeApi;
  const statusLabel = yield* getStatusLabel(sessionListItem);
  const sessionNodeId = yield* makeSessionNodeId(sessionListItem.sessionId);
  const treeItem = new vsCodeApi.TreeItem(sessionListItem.displayName);
  treeItem.id = sessionNodeId;
  treeItem.iconPath = yield* getSessionRowIcon(sessionListItem);
  if (sessionListItem.statusProgress !== undefined) treeItem.description = `${sessionListItem.statusProgress}%`;
  treeItem.resourceUri = yield* getSessionBadgeUri(sessionListItem.sessionId);
  treeItem.tooltip = yield* makeSessionRowTooltip(sessionListItem, statusLabel);
  treeItem.accessibilityInformation = {
    label: SESSION_ROW_LABELS.ACCESSIBLE(sessionListItem.displayName, sessionListItem.projectName, statusLabel)
  };
  treeItem.contextValue = yield* makeSessionRowContextValue(sessionListItem);
  treeItem.command = {
    arguments: [sessionNodeId],
    command: SESSION_COMMANDS.OPEN,
    title: SESSION_ROW_LABELS.OPEN_SESSION
  };

  return treeItem;
});

export const createProjectTreeItem = Effect.fn("ArchiveView.createProjectTreeItem")(function* (
  projectListItem: ProjectListItemDto
) {
  const vsCodeApi = yield* VsCodeApi;
  const treeItem = new vsCodeApi.TreeItem(projectListItem.name, vsCodeApi.TreeItemCollapsibleState.Expanded);
  treeItem.id = yield* makeProjectNodeId(projectListItem.path);
  treeItem.iconPath = new vsCodeApi.ThemeIcon(ROW_ICONS.PROJECT);
  treeItem.tooltip = projectListItem.path;
  treeItem.contextValue = yield* makeRowContextValue(
    projectListItem.isAdded ? SESSIONS_VIEW_CONTEXT_VALUES.ADDED_PROJECT : SESSIONS_VIEW_CONTEXT_VALUES.PROJECT,
    projectListItem,
    []
  );

  return treeItem;
});

// A working session shows the spinner's frame for now.
export const createStatusBadge = Effect.fn("ArchiveView.createStatusBadge")(function* (
  sessionStatus: SessionListItemDto["status"]
) {
  const statusBadge = STATUS_BADGES[sessionStatus];
  if (statusBadge === undefined) return undefined;

  const vsCodeApi = yield* VsCodeApi;
  const frameIndex =
    Math.floor((yield* Clock.currentTimeMillis) / SPINNER_FRAME_INTERVAL_MS) % statusBadge.frames.length;

  return new vsCodeApi.FileDecoration(
    statusBadge.frames[frameIndex],
    STATUS_LABELS[sessionStatus],
    new vsCodeApi.ThemeColor(statusBadge.color)
  );
});
