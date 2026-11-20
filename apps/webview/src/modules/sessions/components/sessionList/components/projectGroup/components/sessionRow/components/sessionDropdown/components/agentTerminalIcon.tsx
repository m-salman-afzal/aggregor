import {BotIcon} from "lucide-react";

interface AgentTerminalIconProps {
  readonly agentIconUri?: string | undefined;
}

export const AgentTerminalIcon = (props: AgentTerminalIconProps) =>
  props.agentIconUri === undefined ? (
    <BotIcon aria-hidden className="size-3.5 shrink-0" />
  ) : (
    <img alt="" className="size-3.5 shrink-0" src={props.agentIconUri} />
  );
