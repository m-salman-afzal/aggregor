import {ArchiveDock} from "@/modules/sessions/components/sessionList/components/archiveDock.tsx";
import {MainList} from "@/modules/sessions/components/sessionList/components/mainList.tsx";
import {ProjectRows} from "@/modules/sessions/components/sessionList/components/projectRows.tsx";
import {useSessionList} from "@/modules/sessions/components/sessionList/sessionList.hook.ts";
import {SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";

interface SessionListProps {
  readonly listId: SessionListId;
}

export const SessionList = (props: SessionListProps) => {
  const sessionListView = useSessionList(props);
  const projectRows = (
    <ProjectRows
      listId={props.listId}
      onAddProject={sessionListView.addProject}
      projectRows={sessionListView.projectRows}
    />
  );
  if (props.listId === SESSION_LISTS.ARCHIVE)
    return (
      <ArchiveDock
        actionGroups={sessionListView.actionGroups}
        isOpen={sessionListView.isOpen}
        onOpenChange={sessionListView.setOpen}
        title={sessionListView.title}
        waitingCount={sessionListView.waitingCount}>
        {projectRows}
      </ArchiveDock>
    );

  return (
    <MainList
      actionGroups={sessionListView.actionGroups}
      inlineActions={sessionListView.inlineActions}
      title={sessionListView.title}
      waitingCount={sessionListView.waitingCount}>
      {projectRows}
    </MainList>
  );
};
