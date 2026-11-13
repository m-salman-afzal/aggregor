import {
  listProjectActionGroups,
  listProjectInlineActions
} from "@/modules/sessions/components/sessionList/components/projectGroup/projectGroup.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {makeProjectKey} from "@/modules/sessions/stores/sessions/sessions.utils.ts";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectRowData} from "@views/sessions/sessions.view.type.ts";

interface UseProjectGroupProps {
  readonly listId: SessionListId;
  readonly projectRow: ProjectRowData;
}

export const useProjectGroup = (props: UseProjectGroupProps) => {
  const projectKey = makeProjectKey(props.listId, props.projectRow.projectListItem.path);
  const isOpen = useSessionsStore({
    selectFromState: (sessionsState) => !sessionsState.collapsedProjectKeys.has(projectKey)
  });
  const setProjectOpen = useSessionsStore({selectFromState: (sessionsState) => sessionsState.setProjectOpen});

  return {
    actionGroups: listProjectActionGroups(props.projectRow.projectListItem, props.listId),
    commandArgument: {projectPath: props.projectRow.projectListItem.path},
    inlineActions: listProjectInlineActions(props.listId),
    isOpen,
    sessionCount: props.projectRow.sessionRows.length,
    setOpen: (isNowOpen: boolean) => {
      setProjectOpen(projectKey, isNowOpen);
    }
  };
};
