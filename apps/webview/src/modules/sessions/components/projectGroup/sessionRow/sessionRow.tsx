import {useSessionRow} from "@/modules/sessions/components/projectGroup/sessionRow/sessionRow.hook.ts";
import {SessionStatusIcon} from "@/modules/sessions/components/projectGroup/sessionRow/sessionStatusIcon/sessionStatusIcon.tsx";
import {cn} from "cn";
import {TriangleAlertIcon} from "lucide-react";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";

interface SessionRowProps {
  readonly sessionRow: SessionRowData;
}

// The first line is the session's title, after its status's icon; the second its agent and status, then how far it got
// and its agent's message, cut to fit. The session in front stays marked.
export const SessionRow = (props: SessionRowProps) => {
  const sessionRowView = useSessionRow(props);

  return (
    <li>
      <button
        aria-current={sessionRowView.isViewed}
        className={cn(
          "flex w-full flex-col gap-0.5 py-1 pr-2 pl-5 text-left outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
          {"bg-row-viewed text-row-viewed-foreground": sessionRowView.isViewed}
        )}
        onClick={sessionRowView.openSession}
        title={sessionRowView.tooltip}
        type="button">
        <span className="flex min-w-0 items-center gap-1.5">
          <SessionStatusIcon status={props.sessionRow.sessionListItem.status} />
          <span className="truncate">{sessionRowView.title}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 pl-5 text-xs text-muted-foreground">
          {props.sessionRow.agentIconUri === undefined ? (
            <TriangleAlertIcon aria-hidden className="size-3 shrink-0" />
          ) : (
            <img alt="" className="size-3 shrink-0" src={props.sessionRow.agentIconUri} />
          )}
          <span className="truncate">{sessionRowView.detail}</span>
        </span>
      </button>
    </li>
  );
};
