import {
  LIST_ACTION_GROUPS,
  LIST_INLINE_ACTIONS,
  SESSION_LISTS,
  SESSIONS_LABELS
} from "@/modules/sessions/sessions.constant.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";

interface UseSessionListProps {
  readonly listId: SessionListId;
}

export const useSessionList = (props: UseSessionListProps) => {
  const isArchive = props.listId === SESSION_LISTS.ARCHIVE;
  const isOpen = useSessionsStore({
    selectFromState: (sessionsState) => !sessionsState.collapsedListIds.has(props.listId)
  });
  const projectRows = useSessionsStore({
    selectFromState: (sessionsState) => (isArchive ? sessionsState.archiveProjectRows : sessionsState.projectRows)
  });
  const waitingCount = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.waitingCounts[props.listId]
  });
  const setListOpen = useSessionsStore({selectFromState: (sessionsState) => sessionsState.setListOpen});

  return {
    actionGroups: LIST_ACTION_GROUPS[props.listId],
    addProject: () => {
      runCommandOnHost(PROJECT_COMMANDS.ADD);
    },
    inlineActions: LIST_INLINE_ACTIONS[props.listId],
    isOpen,
    projectRows,
    setOpen: (isNowOpen: boolean) => {
      setListOpen(props.listId, isNowOpen);
    },
    title: isArchive ? SESSIONS_LABELS.ARCHIVE_TITLE : SESSIONS_LABELS.SESSIONS_TITLE,
    waitingCount
  };
};
