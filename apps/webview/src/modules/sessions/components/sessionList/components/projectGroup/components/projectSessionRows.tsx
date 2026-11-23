import {SessionRow} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.tsx";
import {ShowMoreSessions} from "@/modules/sessions/components/sessionList/components/projectGroup/components/showMoreSessions/showMoreSessions.tsx";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectRowData} from "@/views/sessions/sessions.view.type.ts";

interface ProjectSessionRowsProps {
  readonly listId: SessionListId;
  readonly projectRow: ProjectRowData;
}

export const ProjectSessionRows = (props: ProjectSessionRowsProps) => (
  <>
    <ul className="mt-0.5 flex flex-col gap-0.5 empty:hidden">
      {props.projectRow.sessionRows.map((sessionRow) => (
        <SessionRow key={sessionRow.sessionListItem.sessionId} sessionRow={sessionRow} />
      ))}
    </ul>
    {props.projectRow.sessionPage.hiddenSessionCount > 0 && (
      <ShowMoreSessions listId={props.listId} projectRow={props.projectRow} />
    )}
  </>
);
