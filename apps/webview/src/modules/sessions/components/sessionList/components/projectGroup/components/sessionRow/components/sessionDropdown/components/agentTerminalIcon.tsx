import {BotIcon} from "lucide-react";

interface AgentTerminalIconProps {
  readonly agentIconUri?: string | undefined;
}

// An agent no longer in the settings has no icon of its own.
export const AgentTerminalIcon = (props: AgentTerminalIconProps) =>
  props.agentIconUri === undefined ? (
    <BotIcon aria-hidden className="size-3.5 shrink-0" />
  ) : (
    <img alt="" className="size-3.5 shrink-0" src={props.agentIconUri} />
  );
