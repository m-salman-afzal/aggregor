import {useProjectGroup} from "@/modules/sessions/components/projectGroup/projectGroup.hook.ts";
import {SessionRow} from "@/modules/sessions/components/projectGroup/sessionRow/sessionRow.tsx";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@pkg/ui/src/components/base/collapsible.tsx";
import {ChevronRightIcon} from "lucide-react";

import type {ProjectRowData} from "@views/sessions/sessions.view.type.ts";

interface ProjectGroupProps {
  readonly projectRow: ProjectRowData;
}

// A project's name, which folds its sessions away, over its sessions.
export const ProjectGroup = (props: ProjectGroupProps) => {
  const projectGroupView = useProjectGroup({projectNodeId: props.projectRow.nodeId});

  return (
    <Collapsible onOpenChange={projectGroupView.setOpen} open={projectGroupView.isOpen}>
      <CollapsibleTrigger
        className="group flex w-full items-center gap-1 px-2 py-1 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        title={props.projectRow.projectListItem.path}>
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 shrink-0 transition-transform group-data-panel-open:rotate-90"
        />
        <span className="truncate">{props.projectRow.projectListItem.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="flex flex-col">
          {props.projectRow.sessionRows.map((sessionRow) => (
            <SessionRow key={sessionRow.nodeId} sessionRow={sessionRow} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
