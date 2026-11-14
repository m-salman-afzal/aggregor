import {SessionStatusIcon} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionStatusIcon/sessionStatusIcon.tsx";

import type {SessionListItemDto} from "@dtos/session.dto.ts";

interface SessionTitleProps {
  readonly status: SessionListItemDto["status"];
  readonly title: string;
}

export const SessionTitle = (props: SessionTitleProps) => (
  <span className="flex min-w-0 items-center gap-2">
    <SessionStatusIcon status={props.status} />
    <span className="truncate text-foreground/65 transition-colors duration-150 group-hover/row:text-foreground in-aria-current:font-medium in-aria-current:text-foreground-strong">
      {props.title}
    </span>
  </span>
);
