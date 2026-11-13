import {keepApplyingActions} from "@/modules/sessions/components/sessionList/components/projectGroup/projectGroup.utils.ts";
import {ROW_ACTIONS, SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {SESSION_ROW_LABELS, STATUS_KIND_LABELS, STATUS_LABELS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionListItemDto} from "@dtos/session.dto.ts";

export const listSessionActionGroups = (sessionListItem: SessionListItemDto) =>
  keepApplyingActions([
    [
      sessionListItem.canMoveUp && ROW_ACTIONS.MOVE_SESSION_UP,
      sessionListItem.canMoveDown && ROW_ACTIONS.MOVE_SESSION_DOWN
    ],
    [sessionListItem.isAgentRunning && ROW_ACTIONS.STOP_AGENT],
    [ROW_ACTIONS.RENAME_SESSION, ROW_ACTIONS.REMOVE_SESSION]
  ]);

export const listSessionInlineActions = (sessionListItem: SessionListItemDto) => [
  sessionListItem.isArchived ? ROW_ACTIONS.UNARCHIVE : ROW_ACTIONS.ARCHIVE
];

const getStatusLabel = (sessionListItem: SessionListItemDto) =>
  sessionListItem.statusKind === undefined
    ? STATUS_LABELS[sessionListItem.status]
    : STATUS_KIND_LABELS[sessionListItem.statusKind];

export const makeSessionDetail = (sessionListItem: SessionListItemDto) =>
  [
    ...(sessionListItem.statusProgress === undefined ? [] : [SESSIONS_LABELS.PROGRESS(sessionListItem.statusProgress)]),
    ...(sessionListItem.statusMessage === undefined ? [] : [sessionListItem.statusMessage])
  ].join(SESSIONS_LABELS.DETAIL_SEPARATOR);

export const makeSessionTooltip = (sessionListItem: SessionListItemDto) =>
  [
    SESSION_ROW_LABELS.TOOLTIP_HEADING(sessionListItem.name, getStatusLabel(sessionListItem)),
    ...(sessionListItem.statusMessage === undefined ? [] : [sessionListItem.statusMessage]),
    sessionListItem.projectPath
  ].join("\n");
