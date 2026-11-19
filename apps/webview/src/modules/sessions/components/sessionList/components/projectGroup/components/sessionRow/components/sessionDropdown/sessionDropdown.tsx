import {SESSION_DROPDOWN_LABELS} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionDropdown.constant.ts";
import {makeTaskActivity} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionDropdown.utils.ts";
import {SessionTaskKindIcon} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionTaskKindIcon.tsx";
import {SessionStatusIcon} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionStatusIcon/sessionStatusIcon.tsx";
import {COLLAPSIBLE_PANEL} from "@/modules/sessions/components/sessionList/sessionList.constant.ts";
import {CollapsibleContent} from "@pkg/ui/src/components/base/collapsible.tsx";

import type {SessionTaskDto} from "@dtos/session.dto.ts";

interface SessionDropdownProps {
  readonly sessionTasks: readonly SessionTaskDto[];
}

export const SessionDropdown = (props: SessionDropdownProps) => (
  <CollapsibleContent className={COLLAPSIBLE_PANEL}>
    <section
      aria-label={SESSION_DROPDOWN_LABELS.TASKS}
      className="flex flex-col gap-1 pt-0.5 pr-2 pb-1.5 pl-11 text-xs">
      <h3 className="font-medium text-muted-foreground">{SESSION_DROPDOWN_LABELS.TASKS}</h3>
      <ul className="flex flex-col gap-1">
        {props.sessionTasks.map((sessionTask) => (
          <li className="flex min-w-0 items-center gap-2" key={sessionTask.taskId}>
            <SessionStatusIcon status={sessionTask.state} />
            <SessionTaskKindIcon kind={sessionTask.kind} />
            <span className="min-w-0 truncate text-foreground/80" title={sessionTask.displayName}>
              {sessionTask.displayName}
            </span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground/80">{makeTaskActivity(sessionTask)}</span>
          </li>
        ))}
      </ul>
    </section>
  </CollapsibleContent>
);
