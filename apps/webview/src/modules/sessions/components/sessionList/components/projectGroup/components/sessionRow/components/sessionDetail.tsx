import {AGENT_ICON} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.constant.ts";
import {GitBranchIcon, TriangleAlertIcon} from "lucide-react";

interface SessionDetailProps {
  readonly agentIconUri?: string | undefined;
  readonly agentLabel: string;
  readonly branchName?: string | undefined;
  readonly detail: string;
}

export const SessionDetail = (props: SessionDetailProps) => (
  <span className="flex min-w-0 items-center gap-2 pl-6 text-xs text-muted-foreground">
    {props.agentIconUri === undefined ? (
      <TriangleAlertIcon aria-label={props.agentLabel} className={AGENT_ICON} role="img">
        <title>{props.agentLabel}</title>
      </TriangleAlertIcon>
    ) : (
      <img alt={props.agentLabel} className={AGENT_ICON} src={props.agentIconUri} title={props.agentLabel} />
    )}
    {props.branchName !== undefined && (
      <span className="flex min-w-0 items-center gap-1" title={props.branchName}>
        <GitBranchIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{props.branchName}</span>
      </span>
    )}
    {props.detail !== "" && <span className="truncate">{props.detail}</span>}
  </span>
);
