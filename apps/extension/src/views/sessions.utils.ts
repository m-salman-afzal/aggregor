import {listRepos} from "@/services/repo/repo.utils.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {listSessions} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {getSessionDisplayName} from "@/services/session/terminal.utils.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {getClaudeIcon} from "@/services/vscode.utils.ts";
import {
  COMMANDS,
  CONTEXT_VALUES,
  REPO_ICON,
  SESSION_URI_SCHEME,
  SPINNER_INTERVAL_MS,
  STATUS_BADGES
} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_LABELS, STATUS_LABELS} from "@pkg/constants/src/message.constant.ts";
import {Clock, Effect, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {Repo} from "@/services/repo/repo.service.ts";
import type {Status} from "@/services/session/status.service.ts";
import type {Session} from "@/services/session/store.service.ts";

// How the Sessions tree draws its rows: repo and session items, their status badges, and the tree's shape.

// Repos at the top level, each with the sessions started in it.
export type Row = Repo | Session;

// What a row shows. "unread" is an idle session whose last turn ended while it was out of view; undefined is a
// terminal whose hooks have not fired yet.
export type RowStatus = "unread" | Status;

export const isRepo = (row: Row): row is Repo => "added" in row;

// Without a terminal in this window the agent is gone; with one, the hooks say what it is doing.
export const getRowStatus = Effect.fn("getRowStatus")(function* (
  sessionId: string,
  unreadSessionIds: ReadonlySet<string>
) {
  const {isSessionTerminalOpen} = yield* TerminalService;
  if (!(yield* isSessionTerminalOpen(sessionId))) return "exited" satisfies RowStatus;

  const {sessionStatuses} = yield* StatusService;
  const sessionStatus = (yield* SubscriptionRef.get(sessionStatuses)).get(sessionId);

  return sessionStatus === "idle" && unreadSessionIds.has(sessionId) ? ("unread" satisfies RowStatus) : sessionStatus;
});

// The handle the status badge hangs off; the decoration provider reads the session id back from the path.
export const getSessionRowUri = Effect.fn("getSessionRowUri")(function* (sessionId: string) {
  const {Uri} = yield* VsCodeService;

  return Uri.from({path: `/${sessionId}`, scheme: SESSION_URI_SCHEME});
});

export const createSessionTreeItem = Effect.fn("createSessionTreeItem")(function* (
  session: Session,
  rowStatus: RowStatus | undefined
) {
  const {TreeItem} = yield* VsCodeService;
  const path = yield* Path;
  const statusLabel = rowStatus === undefined ? undefined : STATUS_LABELS[rowStatus];
  const rowLabel = yield* getSessionDisplayName(session);
  const repoFolderName = path.basename(session.cwd);
  const treeItem = new TreeItem(rowLabel);
  treeItem.id = session.id;
  treeItem.iconPath = yield* getClaudeIcon();
  treeItem.resourceUri = yield* getSessionRowUri(session.id);
  treeItem.tooltip = SESSION_LABELS.TOOLTIP(session.name, session.cwd, statusLabel);
  treeItem.accessibilityInformation = {label: SESSION_LABELS.ACCESSIBLE(rowLabel, repoFolderName, statusLabel)};
  treeItem.contextValue = CONTEXT_VALUES.SESSION;
  treeItem.command = {arguments: [session.id], command: COMMANDS.SESSION_ROW.OPEN, title: SESSION_LABELS.OPEN_SESSION};

  return treeItem;
});

// The id is the path, which never collides with a session's UUID.
export const createRepoTreeItem = Effect.fn("createRepoTreeItem")(function* (repo: Repo) {
  const {ThemeIcon, TreeItem, TreeItemCollapsibleState} = yield* VsCodeService;
  const treeItem = new TreeItem(repo.name, TreeItemCollapsibleState.Expanded);
  treeItem.id = repo.path;
  treeItem.iconPath = new ThemeIcon(REPO_ICON);
  treeItem.tooltip = repo.path;
  treeItem.contextValue = repo.added ? CONTEXT_VALUES.ADDED_REPO : CONTEXT_VALUES.REPO;

  return treeItem;
});

export const createStatusBadge = Effect.fn("createStatusBadge")(function* (rowStatus: RowStatus | undefined) {
  if (rowStatus === undefined || rowStatus === "idle") return undefined;

  const {FileDecoration, ThemeColor} = yield* VsCodeService;
  const {color, frames} = STATUS_BADGES[rowStatus];
  const frameIndex = Math.floor((yield* Clock.currentTimeMillis) / SPINNER_INTERVAL_MS) % frames.length;

  return new FileDecoration(frames[frameIndex], STATUS_LABELS[rowStatus], new ThemeColor(color));
});

// Every repo is listed, even one without sessions, so adding a repo always shows. A session sits under the repo whose
// path is its cwd; one whose repo is not in this window is not shown here.
export const getChildRows = Effect.fn("getChildRows")(function* (parentRow: Row | undefined) {
  if (parentRow === undefined) return yield* listRepos();
  if (!isRepo(parentRow)) return [];

  const allSessions = yield* listSessions();

  return allSessions.filter((session) => session.cwd === parentRow.path);
});

export const getParentRow = Effect.fn("getParentRow")(function* (row: Row) {
  if (isRepo(row)) return undefined;

  const repos = yield* listRepos();

  return repos.find((repo) => repo.path === row.cwd);
});
