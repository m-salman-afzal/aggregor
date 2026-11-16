import {useShowMoreSessions} from "@/modules/sessions/components/sessionList/components/projectGroup/components/showMoreSessions/showMoreSessions.hook.ts";
import {ChevronDownIcon} from "lucide-react";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectRowData} from "@views/sessions/sessions.view.type.ts";

interface ShowMoreSessionsProps {
  readonly listId: SessionListId;
  readonly projectRow: ProjectRowData;
}

export const ShowMoreSessions = (props: ShowMoreSessionsProps) => {
  const showMoreSessionsView = useShowMoreSessions(props);

  return (
    <button
      className="flex w-full items-center gap-1.5 rounded-lg py-1 pr-2 pl-5 text-left text-xs text-muted-foreground outline-none hover:bg-level hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={showMoreSessionsView.showMore}
      title={showMoreSessionsView.tooltip}
      type="button">
      <ChevronDownIcon aria-hidden className="size-3.5 shrink-0" />
      <span>{showMoreSessionsView.label}</span>
      {showMoreSessionsView.waitingLabel !== undefined && (
        <span className="text-status-blocked">{showMoreSessionsView.waitingLabel}</span>
      )}
    </button>
  );
};
