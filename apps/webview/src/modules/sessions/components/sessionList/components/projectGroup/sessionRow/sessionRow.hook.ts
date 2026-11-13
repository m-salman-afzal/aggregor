import {VIEWED_ROW} from "@/modules/sessions/components/sessionList/components/projectGroup/sessionRow/sessionRow.constant.ts";
import {
  listSessionActionGroups,
  listSessionInlineActions,
  makeSessionDetail,
  makeSessionTooltip
} from "@/modules/sessions/components/sessionList/components/projectGroup/sessionRow/sessionRow.utils.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";

interface UseSessionRowProps {
  readonly sessionRow: SessionRowData;
}

export const useSessionRow = (props: UseSessionRowProps) => {
  const sessionListItem = props.sessionRow.sessionListItem;
  const isViewed = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.viewedSessionId === sessionListItem.sessionId
  });

  return {
    actionGroups: listSessionActionGroups(sessionListItem),
    agentLabel: sessionListItem.agentName ?? SESSIONS_LABELS.MISSING_AGENT,
    detail: makeSessionDetail(sessionListItem),
    inlineActions: listSessionInlineActions(sessionListItem),
    isViewed,
    openSession: () => {
      runCommandOnHost(SESSION_COMMANDS.OPEN, props.sessionRow.nodeId);
    },
    rowClassName: isViewed ? VIEWED_ROW : undefined,
    title: sessionListItem.displayName,
    tooltip: makeSessionTooltip(sessionListItem)
  };
};
