import {withHarnessInfraService} from "@appUtils/harness.utils.ts";
import {ProjectEntity} from "@entities/project/project.entity.ts";
import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {
  COMMANDS,
  CONTEXT_VALUES,
  PROJECT_ICON,
  SESSION_URI_SCHEME,
  SPINNER_INTERVAL_MS,
  STATUS_BADGES
} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_LABELS, STATUS_LABELS} from "@pkg/constants/src/message.constant.ts";
import {listProjects} from "@services/project.service.ts";
import {listSessions} from "@services/session.service.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Array, Clock, Effect, Result, Schema, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {Row, RowStatus} from "@views/sessions/sessions.view.type.ts";

// How the Sessions tree draws its rows: project and session items, their status badges, and the tree's shape.

// Without a terminal in this window the agent is gone; with one, the hooks say what it is doing.
export const getRowStatus = Effect.fn("SessionsView.getRowStatus")(function* (
  session: SessionEntity,
  unreadSessionIds: ReadonlySet<SessionIdValueObject>
) {
  const {isSessionTerminalOpen} = yield* ITerminalInfraService;
  if (!(yield* isSessionTerminalOpen(session.id))) return "exited" satisfies RowStatus;

  const sessionStatuses = yield* withHarnessInfraService(
    session.harnessId,
    IHarnessInfraService.use((harnessInfraService) => SubscriptionRef.get(harnessInfraService.sessionStatuses))
  );
  const sessionStatus = sessionStatuses.get(session.id);

  return sessionStatus === "idle" && unreadSessionIds.has(session.id) ? ("unread" satisfies RowStatus) : sessionStatus;
});

// The handle the status badge hangs off; the decoration provider reads the session id back from the path.
export const getSessionRowUri = Effect.fn("SessionsView.getSessionRowUri")(function* (sessionId: SessionIdValueObject) {
  const {Uri} = yield* VsCodeApi;

  return Uri.from({path: `/${sessionId}`, scheme: SESSION_URI_SCHEME});
});

export const createSessionTreeItem = Effect.fn("SessionsView.createSessionTreeItem")(function* (
  session: SessionEntity,
  rowStatus: RowStatus | undefined
) {
  const {TreeItem, Uri} = yield* VsCodeApi;
  const path = yield* Path;
  const statusLabel = rowStatus === undefined ? undefined : STATUS_LABELS[rowStatus];
  const rowLabel = session.displayName;
  const projectFolderName = path.basename(session.projectPath);
  const harnessIconPath = yield* withHarnessInfraService(
    session.harnessId,
    IHarnessInfraService.useSync((harnessInfraService) => harnessInfraService.iconPath)
  );
  const treeItem = new TreeItem(rowLabel);
  treeItem.id = session.id;
  treeItem.iconPath = Uri.file(harnessIconPath);
  treeItem.resourceUri = yield* getSessionRowUri(session.id);
  treeItem.tooltip = SESSION_LABELS.TOOLTIP(session.name, session.projectPath, statusLabel);
  treeItem.accessibilityInformation = {label: SESSION_LABELS.ACCESSIBLE(rowLabel, projectFolderName, statusLabel)};
  treeItem.contextValue = CONTEXT_VALUES.SESSION;
  treeItem.command = {arguments: [session.id], command: COMMANDS.SESSION_ROW.OPEN, title: SESSION_LABELS.OPEN_SESSION};

  return treeItem;
});

// The id is the path, which never collides with a session's UUID.
export const createProjectTreeItem = Effect.fn("SessionsView.createProjectTreeItem")(function* (
  project: ProjectEntity
) {
  const {ThemeIcon, TreeItem, TreeItemCollapsibleState} = yield* VsCodeApi;
  const treeItem = new TreeItem(project.name, TreeItemCollapsibleState.Expanded);
  treeItem.id = project.path;
  treeItem.iconPath = new ThemeIcon(PROJECT_ICON);
  treeItem.tooltip = project.path;
  treeItem.contextValue = project.added ? CONTEXT_VALUES.ADDED_PROJECT : CONTEXT_VALUES.PROJECT;

  return treeItem;
});

export const createStatusBadge = Effect.fn("SessionsView.createStatusBadge")(function* (
  rowStatus: RowStatus | undefined
) {
  if (rowStatus === undefined || rowStatus === "idle") return undefined;

  const {FileDecoration, ThemeColor} = yield* VsCodeApi;
  const {color, frames} = STATUS_BADGES[rowStatus];
  const frameIndex = Math.floor((yield* Clock.currentTimeMillis) / SPINNER_INTERVAL_MS) % frames.length;

  return new FileDecoration(frames[frameIndex], STATUS_LABELS[rowStatus], new ThemeColor(color));
});

// Every project is listed, even one without sessions, so adding a project always shows. A session sits under its project; one
// whose project is not in this window is not shown here.
export const getChildRows = Effect.fn("SessionsView.getChildRows")(function* (parentRow: Row | undefined) {
  if (parentRow === undefined) return yield* listProjects();
  if (!Schema.is(ProjectEntity)(parentRow)) return [];

  const allSessions = yield* listSessions();

  return Array.filter(allSessions, (session) => session.projectPath === parentRow.path);
});

export const getParentRow = Effect.fn("SessionsView.getParentRow")(function* (row: Row) {
  if (Schema.is(ProjectEntity)(row)) return undefined;

  const projects = yield* listProjects();

  return Result.getOrUndefined(
    Result.fromOption(
      Array.findFirst(projects, (project) => project.path === row.projectPath),
      () => undefined
    )
  );
});
