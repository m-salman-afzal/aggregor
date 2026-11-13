import {CountBadge} from "@/modules/sessions/components/sessionList/components/countBadge.tsx";
import {RowActions} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.tsx";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";
import type {ReactNode} from "react";

interface MainListProps {
  readonly actionGroups: readonly (readonly RowAction[])[];
  readonly children: ReactNode;
  readonly inlineActions: readonly RowAction[];
  readonly title: string;
  readonly waitingCount: number;
}

export const MainList = (props: MainListProps) => (
  <section className="flex min-h-0 flex-1 flex-col">
    <RowActions actionGroups={props.actionGroups} areActionsAlwaysShown inlineActions={props.inlineActions}>
      <h2 className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <span className="truncate">{props.title}</span>
        {props.waitingCount > 0 && (
          <CountBadge
            count={props.waitingCount}
            isAttention
            label={SESSIONS_LABELS.WAITING_COUNT(props.waitingCount)}
          />
        )}
      </h2>
    </RowActions>
    <div className="scrollbar-minimal min-h-0 flex-1 overflow-y-auto">{props.children}</div>
  </section>
);
