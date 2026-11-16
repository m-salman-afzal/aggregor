import {
  makeShowMoreLabel,
  makeShowMoreTooltip,
  makeShowMoreWaitingLabel
} from "@/modules/sessions/components/sessionList/components/projectGroup/components/showMoreSessions/showMoreSessions.utils.ts";
import {askHostForMoreSessions} from "@/modules/sessions/sessions.service.ts";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectRowData} from "@views/sessions/sessions.view.type.ts";

interface UseShowMoreSessionsProps {
  readonly listId: SessionListId;
  readonly projectRow: ProjectRowData;
}

export const useShowMoreSessions = (props: UseShowMoreSessionsProps) => ({
  label: makeShowMoreLabel(props.projectRow.sessionPage),
  showMore: () => {
    askHostForMoreSessions(props.listId, props.projectRow.projectListItem.path);
  },
  tooltip: makeShowMoreTooltip(props.projectRow.sessionPage),
  waitingLabel: makeShowMoreWaitingLabel(props.projectRow.sessionPage)
});
