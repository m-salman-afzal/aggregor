import {
  PULL_REQUEST_LINK_ATTRIBUTE,
  REVIEW_COMMENTS_SEND_ATTRIBUTE
} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/sessionOpenButton.constant.ts";
import {
  makeAgentActivity,
  makeSessionTooltip
} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.utils.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {GITHUB_CLI_COMMANDS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {REVIEW_COMMENT_COMMANDS} from "@pkg/constants/src/reviewComment.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";

import type {MouseEvent} from "react";

import type {SessionRowData} from "@/views/sessions/sessions.view.type.ts";

interface UseSessionOpenButtonProps {
  readonly sessionRow: SessionRowData;
}

export const useSessionOpenButton = (props: UseSessionOpenButtonProps) => {
  const sessionListItem = props.sessionRow.sessionListItem;
  const isViewed = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.viewedSessionId === sessionListItem.sessionId
  });
  const markViewedSession = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.markViewedSession
  });
  const openSession = (rowClick: MouseEvent<HTMLButtonElement>) => {
    if (rowClick.target instanceof Element && rowClick.target.closest(`[${PULL_REQUEST_LINK_ATTRIBUTE}]`) !== null) {
      runCommandOnHost(GITHUB_CLI_COMMANDS.OPEN_SESSION_PULL_REQUEST, {sessionId: sessionListItem.sessionId});

      return;
    }
    if (rowClick.target instanceof Element && rowClick.target.closest(`[${REVIEW_COMMENTS_SEND_ATTRIBUTE}]`) !== null) {
      runCommandOnHost(REVIEW_COMMENT_COMMANDS.SEND_TO_SESSION, {sessionId: sessionListItem.sessionId});

      return;
    }
    markViewedSession(sessionListItem.sessionId);
    runCommandOnHost(SESSION_COMMANDS.OPEN, {sessionId: sessionListItem.sessionId});
  };

  return {
    agentActivity: makeAgentActivity(sessionListItem),
    agentLabel: sessionListItem.agentName ?? SESSIONS_LABELS.MISSING_AGENT,
    isViewed,
    openSession,
    tooltip: makeSessionTooltip(sessionListItem)
  };
};
