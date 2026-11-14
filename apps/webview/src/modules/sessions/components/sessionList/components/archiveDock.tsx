import {CountBadge} from "@/modules/sessions/components/sessionList/components/countBadge.tsx";
import {RowActions} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.tsx";
import {ARCHIVE_PANEL} from "@/modules/sessions/components/sessionList/sessionList.constant.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@pkg/ui/src/components/base/collapsible.tsx";
import {ChevronUpIcon} from "lucide-react";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";
import type {ReactNode} from "react";

interface ArchiveDockProps {
  readonly actionGroups: readonly (readonly RowAction[])[];
  readonly children: ReactNode;
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly title: string;
  readonly waitingCount: number;
}

export const ArchiveDock = (props: ArchiveDockProps) => (
  <Collapsible className="shrink-0 pt-1" onOpenChange={props.onOpenChange} open={props.isOpen}>
    <RowActions actionGroups={props.actionGroups} className="mx-1.5 mb-1.5">
      <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <span className="shrink-0">{props.title}</span>
        <ChevronUpIcon
          aria-hidden
          className="size-3.5 shrink-0 group-data-panel-open:rotate-180 motion-ok:transition-transform motion-ok:duration-200"
        />
        {props.waitingCount > 0 && (
          <CountBadge
            count={props.waitingCount}
            isAttention
            label={SESSIONS_LABELS.WAITING_COUNT(props.waitingCount)}
          />
        )}
        <span
          aria-hidden
          className="h-px min-w-4 flex-1 bg-hairline transition-opacity duration-150 group-hover/row:opacity-0"
        />
      </CollapsibleTrigger>
    </RowActions>
    <CollapsibleContent className={ARCHIVE_PANEL}>{props.children}</CollapsibleContent>
  </Collapsible>
);
