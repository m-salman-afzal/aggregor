import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {SESSION_ROW_LABELS, STATUS_KIND_LABELS, STATUS_LABELS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";

interface UseSessionRowProps {
  readonly sessionRow: SessionRowData;
}

// A blocked session says what it waits for, when its agent says.
export const useSessionRow = (props: UseSessionRowProps) => {
  const sessionListItem = props.sessionRow.sessionListItem;
  const isViewed = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.viewedSessionId === sessionListItem.sessionId
  });
  const statusLabel =
    sessionListItem.statusKind === undefined
      ? STATUS_LABELS[sessionListItem.status]
      : STATUS_KIND_LABELS[sessionListItem.statusKind];
  const detailParts = [
    sessionListItem.agentName ?? SESSIONS_LABELS.MISSING_AGENT,
    statusLabel,
    ...(sessionListItem.statusProgress === undefined ? [] : [SESSIONS_LABELS.PROGRESS(sessionListItem.statusProgress)]),
    ...(sessionListItem.statusMessage === undefined ? [] : [sessionListItem.statusMessage])
  ];
  const tooltipLines = [
    SESSION_ROW_LABELS.TOOLTIP_HEADING(sessionListItem.name, statusLabel),
    ...(sessionListItem.statusMessage === undefined ? [] : [sessionListItem.statusMessage]),
    sessionListItem.projectPath
  ];

  return {
    detail: detailParts.join(SESSIONS_LABELS.DETAIL_SEPARATOR),
    isViewed,
    openSession: () => {
      runCommandOnHost(SESSION_COMMANDS.OPEN, props.sessionRow.nodeId);
    },
    title: sessionListItem.displayName,
    tooltip: tooltipLines.join("\n")
  };
};
