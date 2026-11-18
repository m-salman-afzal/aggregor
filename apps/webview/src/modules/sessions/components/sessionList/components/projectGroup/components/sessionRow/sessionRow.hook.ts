import {
  PULL_REQUEST_LINK_ATTRIBUTE,
  VIEWED_ROW
} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.constant.ts";
import {
  listSessionActionGroups,
  listSessionInlineActions,
  makeAgentActivity,
  makeSessionTooltip,
  selectIsSessionInGitProject
} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.utils.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {GITHUB_CLI_COMMANDS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";
import type {MouseEvent} from "react";

interface UseSessionRowProps {
  readonly sessionRow: SessionRowData;
}

export const useSessionRow = (props: UseSessionRowProps) => {
  const sessionListItem = props.sessionRow.sessionListItem;
  const isViewed = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.viewedSessionId === sessionListItem.sessionId
  });
  const isInGitProject = useSessionsStore({selectFromState: selectIsSessionInGitProject(sessionListItem)});
  const markViewedSession = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.markViewedSession
  });
  const openSession = (rowClick: MouseEvent<HTMLButtonElement>) => {
    if (rowClick.target instanceof Element && rowClick.target.closest(`[${PULL_REQUEST_LINK_ATTRIBUTE}]`) !== null) {
      runCommandOnHost(GITHUB_CLI_COMMANDS.OPEN_SESSION_PULL_REQUEST, {sessionId: sessionListItem.sessionId});

      return;
    }
    markViewedSession(sessionListItem.sessionId);
    runCommandOnHost(SESSION_COMMANDS.OPEN, {sessionId: sessionListItem.sessionId});
  };

  return {
    actionGroups: listSessionActionGroups(sessionListItem, isInGitProject),
    agentActivity: makeAgentActivity(sessionListItem),
    agentLabel: sessionListItem.agentName ?? SESSIONS_LABELS.MISSING_AGENT,
    commandArgument: {sessionId: sessionListItem.sessionId},
    inlineActions: listSessionInlineActions(sessionListItem),
    isViewed,
    openSession,
    rowClassName: isViewed ? VIEWED_ROW : undefined,
    tooltip: makeSessionTooltip(sessionListItem)
  };
};
