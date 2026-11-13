import {SESSION_STATUS_ICONS} from "@/modules/sessions/components/projectGroup/sessionRow/sessionStatusIcon/sessionStatusIcon.constant.ts";
import {cn} from "cn";

import type {SessionListItemDto} from "@dtos/session.dto.ts";

interface SessionStatusIconProps {
  readonly status: SessionListItemDto["status"];
}

export const SessionStatusIcon = (props: SessionStatusIconProps) => {
  const statusIcon = SESSION_STATUS_ICONS[props.status];

  return <statusIcon.StatusIcon aria-hidden className={cn("size-3.5 shrink-0", statusIcon.className)} />;
};
