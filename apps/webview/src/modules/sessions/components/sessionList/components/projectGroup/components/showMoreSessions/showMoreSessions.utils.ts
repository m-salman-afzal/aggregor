import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {SESSION_PAGES} from "@pkg/constants/src/session.constant.ts";

import type {SessionPageDto} from "@/dtos/session.dto.ts";

export const makeShowMoreLabel = (sessionPage: SessionPageDto) =>
  SESSIONS_LABELS.SHOW_MORE_SESSIONS(Math.min(sessionPage.hiddenSessionCount, SESSION_PAGES.PAGE_SIZE));

export const makeShowMoreWaitingLabel = (sessionPage: SessionPageDto) =>
  sessionPage.hiddenWaitingCount === 0 ? undefined : SESSIONS_LABELS.WAITING_COUNT(sessionPage.hiddenWaitingCount);

export const makeShowMoreTooltip = (sessionPage: SessionPageDto) =>
  SESSIONS_LABELS.HIDDEN_SESSIONS(sessionPage.hiddenSessionCount, sessionPage.totalSessionCount);
