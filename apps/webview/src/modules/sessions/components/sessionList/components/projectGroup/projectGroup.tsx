import {CountBadge} from "@/modules/sessions/components/sessionList/components/countBadge.tsx";
import {useProjectGroup} from "@/modules/sessions/components/sessionList/components/projectGroup/projectGroup.hook.ts";
import {SessionRow} from "@/modules/sessions/components/sessionList/components/projectGroup/sessionRow/sessionRow.tsx";
import {RowActions} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.tsx";
import {PROJECT_PANEL} from "@/modules/sessions/components/sessionList/sessionList.constant.ts";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@pkg/ui/src/components/base/collapsible.tsx";
import {ChevronRightIcon} from "lucide-react";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectRowData} from "@views/sessions/sessions.view.type.ts";

interface ProjectGroupProps {
  readonly listId: SessionListId;
  readonly projectRow: ProjectRowData;
}

export const ProjectGroup = (props: ProjectGroupProps) => {
  const projectGroupView = useProjectGroup(props);

  return (
    <Collapsible onOpenChange={projectGroupView.setOpen} open={projectGroupView.isOpen}>
      <RowActions
        actionGroups={projectGroupView.actionGroups}
        commandArgument={projectGroupView.commandArgument}
        inlineActions={projectGroupView.inlineActions}>
        <CollapsibleTrigger
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pr-2 pl-2 text-left font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          title={props.projectRow.projectListItem.path}>
          <ChevronRightIcon
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground group-data-panel-open:rotate-90 motion-ok:transition-transform motion-ok:duration-200"
          />
          <span className="truncate">{props.projectRow.projectListItem.name}</span>
          <CountBadge count={projectGroupView.sessionCount} />
        </CollapsibleTrigger>
      </RowActions>
      <CollapsibleContent className={PROJECT_PANEL}>
        <ul className="mt-0.5 flex flex-col gap-0.5 empty:hidden">
          {props.projectRow.sessionRows.map((sessionRow) => (
            <SessionRow key={sessionRow.sessionListItem.sessionId} sessionRow={sessionRow} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
