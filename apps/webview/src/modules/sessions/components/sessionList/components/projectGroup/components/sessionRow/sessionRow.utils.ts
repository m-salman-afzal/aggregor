import {keepApplyingActions} from "@/modules/sessions/components/sessionList/components/projectGroup/projectGroup.utils.ts";
import {ROW_ACTIONS, SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {SESSION_ROW_LABELS, STATUS_KIND_LABELS, STATUS_LABELS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionsState} from "@/modules/sessions/stores/sessions/sessions.type.ts";
import type {SessionListItemDto} from "@dtos/session.dto.ts";

// Only the Sessions list reads a project's worktrees, so an archived session never counts as in git.
export const selectIsSessionInGitProject = (sessionListItem: SessionListItemDto) => (sessionsState: SessionsState) =>
  sessionsState.projectRows.some(
    (projectRow) =>
      projectRow.projectListItem.path === sessionListItem.projectPath && projectRow.worktrees !== undefined
  );

export const listSessionActionGroups = (sessionListItem: SessionListItemDto, isInGitProject: boolean) =>
  keepApplyingActions([
    [
      sessionListItem.canMoveUp && ROW_ACTIONS.MOVE_SESSION_UP,
      sessionListItem.canMoveDown && ROW_ACTIONS.MOVE_SESSION_DOWN
    ],
    [sessionListItem.isAgentRunning && ROW_ACTIONS.STOP_AGENT],
    [
      sessionListItem.pullRequest !== undefined && ROW_ACTIONS.OPEN_PULL_REQUEST,
      isInGitProject &&
        (sessionListItem.isPullRequestLinked ? ROW_ACTIONS.CHANGE_PULL_REQUEST : ROW_ACTIONS.LINK_PULL_REQUEST),
      sessionListItem.isPullRequestLinked && ROW_ACTIONS.UNLINK_PULL_REQUEST
    ],
    [
      ROW_ACTIONS.RENAME_SESSION,
      sessionListItem.agentConversationId !== undefined && ROW_ACTIONS.COPY_SESSION_ID,
      sessionListItem.worktreePath !== undefined && ROW_ACTIONS.RENAME_BRANCH,
      isInGitProject && ROW_ACTIONS.CHANGE_WORKING_TREE,
      isInGitProject && sessionListItem.worktreePath !== undefined && ROW_ACTIONS.UNLINK_WORKTREE,
      ROW_ACTIONS.REMOVE_SESSION
    ]
  ]);

export const listSessionInlineActions = (sessionListItem: SessionListItemDto) =>
  sessionListItem.isArchived
    ? [ROW_ACTIONS.UNARCHIVE]
    : [ROW_ACTIONS.OPEN_SESSION_FOLDER_TERMINAL, ROW_ACTIONS.ARCHIVE];

const getStatusLabel = (sessionListItem: SessionListItemDto) =>
  sessionListItem.statusKind === undefined
    ? STATUS_LABELS[sessionListItem.status]
    : STATUS_KIND_LABELS[sessionListItem.statusKind];

export const makeAgentActivity = (sessionListItem: SessionListItemDto) =>
  [
    ...(sessionListItem.statusProgress === undefined ? [] : [SESSIONS_LABELS.PROGRESS(sessionListItem.statusProgress)]),
    ...(sessionListItem.statusMessage === undefined ? [] : [sessionListItem.statusMessage])
  ].join(SESSIONS_LABELS.DETAIL_SEPARATOR);

export const makeSessionTooltip = (sessionListItem: SessionListItemDto) =>
  [
    SESSION_ROW_LABELS.TOOLTIP_HEADING(sessionListItem.name, getStatusLabel(sessionListItem)),
    ...(sessionListItem.statusMessage === undefined ? [] : [sessionListItem.statusMessage]),
    sessionListItem.projectPath,
    ...(sessionListItem.agentConversationId === undefined
      ? []
      : [SESSION_ROW_LABELS.TOOLTIP_SESSION_ID(sessionListItem.agentConversationId)])
  ].join("\n");
