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

// How the Sessions tree draws what its controllers return: project and session rows, and session badges.

// The URI a session row's badge hangs off; the badge provider reads the session id back from its path.
export const getSessionBadgeUri = Effect.fn("SessionsView.getSessionBadgeUri")(function* (sessionId: string) {
  const {Uri} = yield* VsCodeApi;

  return Uri.from({path: `/${sessionId}`, scheme: SESSION_BADGE_URI_SCHEME});
});

// The row's kind, then the ways it can move, which the manifest's menus match.
const makeRowContextValue = Effect.fn("SessionsView.makeRowContextValue")(function* (
  rowKind: string,
  listItem: ProjectListItemDto | SessionListItemDto
) {
  const moveWords = [
    ...(listItem.canMoveUp ? [SESSIONS_VIEW_CONTEXT_VALUES.CAN_MOVE_UP] : []),
    ...(listItem.canMoveDown ? [SESSIONS_VIEW_CONTEXT_VALUES.CAN_MOVE_DOWN] : [])
  ];

  return Array.join([rowKind, ...moveWords], " ");
});

// The agent's image; a session whose agent is gone shows a warning.
const getSessionRowIcon = Effect.fn("SessionsView.getSessionRowIcon")(function* (sessionListItem: SessionListItemDto) {
  const {ThemeIcon, Uri} = yield* VsCodeApi;

  return sessionListItem.icon === undefined ? new ThemeIcon(ROW_ICONS.MISSING_AGENT) : Uri.file(sessionListItem.icon);
});

// A blocked session says what it waits for, when its agent says.
const getStatusLabel = Effect.fn("SessionsView.getStatusLabel")(function* (sessionListItem: SessionListItemDto) {
  return sessionListItem.statusKind === undefined
    ? STATUS_LABELS[sessionListItem.status]
    : STATUS_KIND_LABELS[sessionListItem.statusKind];
});

export const createSessionTreeItem = Effect.fn("SessionsView.createSessionTreeItem")(function* (
  sessionListItem: SessionListItemDto
) {
  const {TreeItem} = yield* VsCodeApi;
  const statusLabel = yield* getStatusLabel(sessionListItem);
  const sessionNodeId = yield* makeSessionNodeId(sessionListItem.sessionId);
  const {displayName, statusProgress} = sessionListItem;
  const treeItem = new TreeItem(displayName);
  treeItem.id = sessionNodeId;
  treeItem.iconPath = yield* getSessionRowIcon(sessionListItem);
  if (statusProgress !== undefined) treeItem.description = `${statusProgress}%`;
  treeItem.resourceUri = yield* getSessionBadgeUri(sessionListItem.sessionId);
  treeItem.tooltip = SESSION_ROW_LABELS.TOOLTIP({
    sessionName: sessionListItem.name,
    statusLabel,
    statusMessage: sessionListItem.statusMessage,
    workingDirectory: sessionListItem.projectPath
  });
  treeItem.accessibilityInformation = {
    label: SESSION_ROW_LABELS.ACCESSIBLE(displayName, sessionListItem.projectName, statusLabel)
  };
  treeItem.contextValue = yield* makeRowContextValue(SESSIONS_VIEW_CONTEXT_VALUES.SESSION, sessionListItem);
  treeItem.command = {
    arguments: [sessionNodeId],
    command: SESSION_COMMANDS.OPEN,
    title: SESSION_ROW_LABELS.OPEN_SESSION
  };

  return treeItem;
});

export const createProjectTreeItem = Effect.fn("SessionsView.createProjectTreeItem")(function* (
  projectListItem: ProjectListItemDto
) {
  const {ThemeIcon, TreeItem, TreeItemCollapsibleState} = yield* VsCodeApi;
  const treeItem = new TreeItem(projectListItem.name, TreeItemCollapsibleState.Expanded);
  treeItem.id = yield* makeProjectNodeId(projectListItem.path);
  treeItem.iconPath = new ThemeIcon(ROW_ICONS.PROJECT);
  treeItem.tooltip = projectListItem.path;
  treeItem.contextValue = yield* makeRowContextValue(
    projectListItem.isAdded ? SESSIONS_VIEW_CONTEXT_VALUES.ADDED_PROJECT : SESSIONS_VIEW_CONTEXT_VALUES.PROJECT,
    projectListItem
  );

  return treeItem;
});

// A working session shows the spinner's frame for now.
export const createStatusBadge = Effect.fn("SessionsView.createStatusBadge")(function* (
  sessionStatus: SessionListItemDto["status"]
) {
  const statusBadge = STATUS_BADGES[sessionStatus];
  if (statusBadge === undefined) return undefined;

  const {FileDecoration, ThemeColor} = yield* VsCodeApi;
  const {color, frames} = statusBadge;
  const frameIndex = Math.floor((yield* Clock.currentTimeMillis) / SPINNER_FRAME_INTERVAL_MS) % frames.length;

  return new FileDecoration(frames[frameIndex], STATUS_LABELS[sessionStatus], new ThemeColor(color));
});
