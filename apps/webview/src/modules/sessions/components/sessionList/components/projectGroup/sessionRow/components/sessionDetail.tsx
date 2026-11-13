import {AGENT_ICON} from "@/modules/sessions/components/sessionList/components/projectGroup/sessionRow/sessionRow.constant.ts";
import {TriangleAlertIcon} from "lucide-react";

interface SessionDetailProps {
  readonly agentIconUri?: string | undefined;
  readonly agentLabel: string;
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
    {props.detail !== "" && <span className="truncate">{props.detail}</span>}
  </span>
);
