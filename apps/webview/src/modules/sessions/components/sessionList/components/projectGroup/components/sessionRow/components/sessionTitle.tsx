import {SessionStatusIcon} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionStatusIcon/sessionStatusIcon.tsx";

import type {SessionListItemDto} from "@dtos/session.dto.ts";

interface SessionTitleProps {
  readonly agentActivity: string;
  readonly sessionListItem: SessionListItemDto;
}

export const SessionTitle = (props: SessionTitleProps) => (
  <span className="flex min-w-0 items-center gap-2">
    <SessionStatusIcon status={props.sessionListItem.status} />
    <span className="min-w-0 truncate text-foreground/65 transition-colors duration-150 group-hover/row:text-foreground in-aria-current:font-medium in-aria-current:text-foreground-strong">
      {props.sessionListItem.displayName}
    </span>
    {props.agentActivity !== "" && (
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/80">{props.agentActivity}</span>
    )}
  </span>
);
