import {SessionTaskKindIcon} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/sessionTaskList/sessionTaskKindIcon.tsx";
import {SESSION_TASK_LIST_LABELS} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/sessionTaskList/sessionTaskList.constant.ts";
import {makeTaskActivity} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/sessionTaskList/sessionTaskList.utils.ts";
import {SessionStatusIcon} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionStatusIcon/sessionStatusIcon.tsx";

import type {SessionTaskDto} from "@/dtos/session.dto.ts";

interface SessionTaskListProps {
  readonly sessionTasks: readonly SessionTaskDto[];
}

export const SessionTaskList = (props: SessionTaskListProps) => (
  <section aria-label={SESSION_TASK_LIST_LABELS.TASKS} className="flex flex-col gap-1">
    <h3 className="font-medium text-muted-foreground">{SESSION_TASK_LIST_LABELS.TASKS}</h3>
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
);
