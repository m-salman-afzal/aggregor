import {Context, Effect, Layer, Match} from "effect";

import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {REVIEW_COMMENT_ERRORS} from "@pkg/constants/src/reviewComment.constant.ts";

import type {ReviewCommentService} from "@/services/reviewComment.service.ts";

type ReviewCommentCommandError =
  | Effect.Error<ReturnType<ReviewCommentService["Service"]["addReviewComment"]>>
  | Effect.Error<ReturnType<ReviewCommentService["Service"]["editReviewComment"]>>
  | Effect.Error<ReturnType<ReviewCommentService["Service"]["sendSessionReviewComments"]>>
  | Effect.Error<ReviewCommentService["Service"]["sendReviewComments"]>;

export class ReviewCommentErrorMessage extends Context.Service<ReviewCommentErrorMessage>()(
  "aggregor-app/presentation/errorMessages/reviewComment.errorMessage/ReviewCommentErrorMessage",
  {
    make: Effect.fn("ReviewCommentErrorMessage.make")(function* () {
      const getReviewCommentCommandErrorMessage = Effect.fn(
        "ReviewCommentErrorMessage.getReviewCommentCommandErrorMessage"
      )(function* (reviewCommentCommandError: ReviewCommentCommandError) {
        return Match.valueTags(reviewCommentCommandError, {
          DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
          DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
          NoReviewCommentsError: () => ({message: REVIEW_COMMENT_ERRORS.NO_REVIEW_COMMENTS}),
          NoSessionForReviewCommentsError: () => ({message: REVIEW_COMMENT_ERRORS.NO_SESSION_FOR_REVIEW_COMMENTS}),
          SessionAgentNotRunningError: (error) => ({
            message: REVIEW_COMMENT_ERRORS.SESSION_AGENT_NOT_RUNNING(error.sessionDisplayName)
          }),
          SessionNotShownError: (error) => ({
            message: REVIEW_COMMENT_ERRORS.SESSION_NOT_SHOWN(error.sessionDisplayName)
          })
        });
      });

      return {getReviewCommentCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
