import {COLLAPSIBLE_PANEL} from "@/modules/sessions/components/sessionList/sessionList.constant.ts";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@pkg/ui/src/components/base/collapsible.tsx";
import {ChevronRightIcon} from "lucide-react";

import type {ProcessTreeItem} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/terminalProcessList/terminalProcessList.type.ts";

interface ProcessTreeNodeProps {
  readonly processTreeItem: ProcessTreeItem;
}

export const ProcessTreeNode = (props: ProcessTreeNodeProps) => (
  <li title={props.processTreeItem.sessionProcess.commandLine}>
    {props.processTreeItem.childItems.length === 0 ? (
      <div className="flex min-w-0 items-center gap-1.5 py-px text-foreground/80">
        <span aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{props.processTreeItem.sessionProcess.name}</span>
      </div>
    ) : (
      <Collapsible>
        <CollapsibleTrigger className="group/process flex w-full min-w-0 items-center gap-1.5 rounded-md py-px text-left text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <ChevronRightIcon
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground group-data-panel-open/process:rotate-90 motion-ok:transition-transform motion-ok:duration-200"
          />
          <span className="truncate">{props.processTreeItem.sessionProcess.name}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className={COLLAPSIBLE_PANEL}>
          <ul className="ml-[0.4375rem] flex flex-col border-l border-hairline pl-1.5">
            {props.processTreeItem.childItems.map((childItem) => (
              <ProcessTreeNode key={childItem.sessionProcess.processId} processTreeItem={childItem} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    )}
  </li>
);
