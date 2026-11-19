import {VIEWED_ROW} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.constant.ts";
import {
  listSessionActionGroups,
  listSessionInlineActions,
  selectIsSessionInGitProject
} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";

interface UseSessionRowProps {
  readonly sessionRow: SessionRowData;
}

export const useSessionRow = (props: UseSessionRowProps) => {
  const sessionListItem = props.sessionRow.sessionListItem;
  const isViewed = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.viewedSessionId === sessionListItem.sessionId
  });
  const isInGitProject = useSessionsStore({selectFromState: selectIsSessionInGitProject(sessionListItem)});
  const isDropdownOpen = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.openDropdownSessionIds.has(sessionListItem.sessionId)
  });
  const setSessionDropdownOpen = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.setSessionDropdownOpen
  });
  const setDropdownOpen = (isNowOpen: boolean) => {
    setSessionDropdownOpen(sessionListItem.sessionId, isNowOpen);
  };
  // A running agent's terminal always has its processes to show.
  const hasDropdown = sessionListItem.isAgentRunning;

  return {
    actionGroups: listSessionActionGroups(sessionListItem, isInGitProject),
    commandArgument: {sessionId: sessionListItem.sessionId},
    hasDropdown,
    inlineActions: listSessionInlineActions(sessionListItem),
    isDropdownOpen: hasDropdown && isDropdownOpen,
    rowClassName: isViewed ? VIEWED_ROW : undefined,
    setDropdownOpen
  };
};
