import {ProcessTreeNode} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/terminalProcessList/processTreeNode.tsx";
import {buildProcessTree} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/terminalProcessList/terminalProcessList.utils.ts";
import {COLLAPSIBLE_PANEL} from "@/modules/sessions/components/sessionList/sessionList.constant.ts";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@pkg/ui/src/components/base/collapsible.tsx";
import {ChevronRightIcon} from "lucide-react";

import type {TerminalProcessesDto} from "@dtos/sessionProcess.dto.ts";
import type {ReactNode} from "react";

interface TerminalProcessListProps {
  readonly label: string;
  readonly labelIcon: ReactNode;
  readonly note?: string | undefined;
  readonly terminalProcesses: TerminalProcessesDto;
}

export const TerminalProcessList = (props: TerminalProcessListProps) => (
  <Collapsible render={<section aria-label={props.label} className="flex flex-col gap-1" />}>
    <h3 className="min-w-0 font-medium text-muted-foreground">
      <CollapsibleTrigger className="group/terminal flex w-full min-w-0 items-center gap-1.5 rounded-md text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 shrink-0 group-data-panel-open/terminal:rotate-90 motion-ok:transition-transform motion-ok:duration-200"
        />
        {props.labelIcon}
        <span className="truncate">{props.label}</span>
      </CollapsibleTrigger>
    </h3>
    {props.note !== undefined && <p className="pl-10 text-muted-foreground/80">{props.note}</p>}
    <CollapsibleContent className={COLLAPSIBLE_PANEL}>
      <ul className="ml-[0.4375rem] flex flex-col border-l border-hairline pl-1.5">
        {buildProcessTree(props.terminalProcesses.processes).map((processTreeItem) => (
          <ProcessTreeNode key={processTreeItem.sessionProcess.processId} processTreeItem={processTreeItem} />
        ))}
      </ul>
    </CollapsibleContent>
  </Collapsible>
);
