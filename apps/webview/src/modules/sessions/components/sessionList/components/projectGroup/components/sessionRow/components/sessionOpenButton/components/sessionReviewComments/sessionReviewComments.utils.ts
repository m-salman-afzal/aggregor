import {SESSION_ROW_LABELS} from "@pkg/constants/src/sessionsView.constant.ts";

export const makeReviewCommentsTooltip = (pendingReviewCommentCount: number) =>
  pendingReviewCommentCount === 1
    ? SESSION_ROW_LABELS.REVIEW_COMMENT_TOOLTIP
    : SESSION_ROW_LABELS.REVIEW_COMMENTS_TOOLTIP(pendingReviewCommentCount);
