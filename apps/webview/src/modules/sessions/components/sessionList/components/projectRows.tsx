import {EmptyState} from "@/modules/sessions/components/sessionList/components/emptyState.tsx";
import {ProjectGroup} from "@/modules/sessions/components/sessionList/components/projectGroup/projectGroup.tsx";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectRowData} from "@views/sessions/sessions.view.type.ts";

interface ProjectRowsProps {
  readonly listId: SessionListId;
  readonly onAddProject: () => void;
  readonly projectRows: readonly ProjectRowData[];
}

export const ProjectRows = (props: ProjectRowsProps) => {
  if (props.projectRows.length === 0) return <EmptyState listId={props.listId} onAddProject={props.onAddProject} />;

  return (
    <div className="flex flex-col gap-1.5 pb-2 pl-1.5">
      {props.projectRows.map((projectRow) => (
        <ProjectGroup key={projectRow.nodeId} listId={props.listId} projectRow={projectRow} />
      ))}
    </div>
  );
};
