import {TASK_KIND_ICONS} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/sessionTaskList/sessionTaskList.constant.ts";

import type {SessionTaskDto} from "@dtos/session.dto.ts";

interface SessionTaskKindIconProps {
  readonly kind: SessionTaskDto["kind"];
}

export const SessionTaskKindIcon = (props: SessionTaskKindIconProps) => {
  const taskKindIcon = TASK_KIND_ICONS[props.kind];

  return (
    <taskKindIcon.TaskKindIcon
      aria-label={taskKindIcon.label}
      className="size-3.5 shrink-0 text-muted-foreground"
      role="img">
      <title>{taskKindIcon.label}</title>
    </taskKindIcon.TaskKindIcon>
  );
};
