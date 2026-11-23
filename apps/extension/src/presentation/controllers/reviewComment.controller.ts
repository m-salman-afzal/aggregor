import {Context, Effect, Layer} from "effect";

import {
  AddReviewCommentRequestDtoSchema,
  EditReviewCommentRequestDtoSchema,
  MoveReviewCommentRequestDtoSchema,
  RemoveReviewCommentRequestDtoSchema,
  SendSessionReviewCommentsRequestDtoSchema
} from "@/dtos/reviewComment.dto.ts";
import {ReviewCommentErrorMessage} from "@/errorMessages/reviewComment.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {ReviewCommentService} from "@/services/reviewComment.service.ts";
import {REVIEW_COMMENT_COMMANDS} from "@pkg/constants/src/reviewComment.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

export class ReviewCommentController extends Context.Service<ReviewCommentController>()(
  "aggregor-app/presentation/controllers/reviewComment.controller/ReviewCommentController",
  {
    make: Effect.fn("ReviewCommentController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const reviewCommentService = yield* ReviewCommentService;
      const reviewCommentErrorMessage = yield* ReviewCommentErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const addWrittenReviewComment = Effect.fn("ReviewCommentController.addWrittenReviewComment")(function* (
        writtenReviewComment: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(AddReviewCommentRequestDtoSchema, writtenReviewComment);
        yield* reviewCommentService.addReviewComment(request);
      });

      const editChosenReviewComment = Effect.fn("ReviewCommentController.editChosenReviewComment")(function* (
        chosenReviewComment: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(EditReviewCommentRequestDtoSchema, chosenReviewComment);
        yield* reviewCommentService.editReviewComment(request);
      });

      const removeChosenReviewComment = Effect.fn("ReviewCommentController.removeChosenReviewComment")(function* (
        chosenReviewComment: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(
          RemoveReviewCommentRequestDtoSchema,
          chosenReviewComment
        );
        yield* reviewCommentService.removeReviewComment(request);
      });

      const moveShownReviewComment = Effect.fn("ReviewCommentController.moveShownReviewComment")(function* (
        shownReviewComment: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(MoveReviewCommentRequestDtoSchema, shownReviewComment);
        yield* reviewCommentService.moveReviewComment(request);
      });

      const sendPendingReviewComments = Effect.fn("ReviewCommentController.sendPendingReviewComments")(function* () {
        yield* reviewCommentService.sendReviewComments;
      });

      const sendChosenSessionReviewComments = Effect.fn("ReviewCommentController.sendChosenSessionReviewComments")(
        function* (chosenSession: unknown) {
          const request = yield* vscodeUtils.decodeVsCodeArgument(
            SendSessionReviewCommentsRequestDtoSchema,
            chosenSession
          );
          yield* reviewCommentService.sendSessionReviewComments(request);
        }
      );

      const listReviewCommentsForReviewCommentsView = Effect.fn(
        "ReviewCommentController.listReviewCommentsForReviewCommentsView"
      )(function* () {
        return yield* reviewCommentService.listReviewComments;
      });

      const watchReviewCommentChangesForReviewCommentsView = Effect.fn(
        "ReviewCommentController.watchReviewCommentChangesForReviewCommentsView"
      )(function* () {
        return yield* reviewCommentService.watchReviewCommentChanges;
      });

      yield* registerCommandMiddleware.registerCommand(
        REVIEW_COMMENT_COMMANDS.ADD,
        addWrittenReviewComment,
        reviewCommentErrorMessage.getReviewCommentCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        REVIEW_COMMENT_COMMANDS.EDIT,
        editChosenReviewComment,
        reviewCommentErrorMessage.getReviewCommentCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        REVIEW_COMMENT_COMMANDS.REMOVE,
        removeChosenReviewComment,
        reviewCommentErrorMessage.getReviewCommentCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        REVIEW_COMMENT_COMMANDS.MOVE,
        moveShownReviewComment,
        reviewCommentErrorMessage.getReviewCommentCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        REVIEW_COMMENT_COMMANDS.SEND,
        sendPendingReviewComments,
        reviewCommentErrorMessage.getReviewCommentCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        REVIEW_COMMENT_COMMANDS.SEND_TO_SESSION,
        sendChosenSessionReviewComments,
        reviewCommentErrorMessage.getReviewCommentCommandErrorMessage
      );

      return {
        addWrittenReviewComment,
        editChosenReviewComment,
        listReviewCommentsForReviewCommentsView: listReviewCommentsForReviewCommentsView(),
        moveShownReviewComment,
        removeChosenReviewComment,
        sendChosenSessionReviewComments,
        sendPendingReviewComments,
        watchReviewCommentChangesForReviewCommentsView: watchReviewCommentChangesForReviewCommentsView()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([ReviewCommentErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
