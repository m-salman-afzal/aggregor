import {MessageSquareTextIcon} from "lucide-react";

import {makeReviewCommentsTooltip} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/components/sessionReviewComments/sessionReviewComments.utils.ts";
import {REVIEW_COMMENTS_SEND_ATTRIBUTE} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/sessionOpenButton.constant.ts";

interface SessionReviewCommentsProps {
  readonly pendingReviewCommentCount: number;
}

export const SessionReviewComments = (props: SessionReviewCommentsProps) => (
  <span
    {...{[REVIEW_COMMENTS_SEND_ATTRIBUTE]: true}}
    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-sm tabular-nums underline-offset-2 hover:text-foreground hover:underline"
    title={makeReviewCommentsTooltip(props.pendingReviewCommentCount)}>
    <MessageSquareTextIcon aria-hidden className="size-3.5 shrink-0" />
    <span>{props.pendingReviewCommentCount}</span>
  </span>
);
