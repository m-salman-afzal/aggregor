import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";

import type {SessionTaskDto} from "@/dtos/session.dto.ts";

export const makeTaskActivity = (sessionTask: SessionTaskDto) =>
  [
    ...(sessionTask.statusProgress === undefined ? [] : [SESSIONS_LABELS.PROGRESS(sessionTask.statusProgress)]),
    ...(sessionTask.statusMessage === undefined ? [] : [sessionTask.statusMessage])
  ].join(SESSIONS_LABELS.DETAIL_SEPARATOR);
