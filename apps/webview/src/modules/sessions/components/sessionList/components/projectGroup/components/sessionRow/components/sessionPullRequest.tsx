import {
  PULL_REQUEST_LINK_ATTRIBUTE,
  PULL_REQUEST_STATE_ICONS
} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.constant.ts";
import {PULL_REQUEST_STATE_LABELS, SESSION_ROW_LABELS} from "@pkg/constants/src/sessionsView.constant.ts";
import {cn} from "cn";

import type {SessionPullRequestDto} from "@dtos/session.dto.ts";

interface SessionPullRequestProps {
  readonly pullRequest: SessionPullRequestDto;
}

export const SessionPullRequest = (props: SessionPullRequestProps) => {
  const stateIcon = PULL_REQUEST_STATE_ICONS[props.pullRequest.state];

  return (
    <span
      {...{[PULL_REQUEST_LINK_ATTRIBUTE]: true}}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1 rounded-sm tabular-nums underline-offset-2 hover:underline",
        stateIcon.className
      )}
      title={SESSION_ROW_LABELS.PULL_REQUEST_TOOLTIP(
        props.pullRequest.title,
        PULL_REQUEST_STATE_LABELS[props.pullRequest.state]
      )}>
      <stateIcon.PullRequestIcon aria-hidden className="size-3.5 shrink-0" />
      <span>{SESSION_ROW_LABELS.PULL_REQUEST(props.pullRequest.number)}</span>
    </span>
  );
};
