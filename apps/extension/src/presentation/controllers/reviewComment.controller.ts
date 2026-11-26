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

import type {
  AddReviewCommentRequestDto,
  EditReviewCommentRequestDto,
  MoveReviewCommentRequestDto,
  RemoveReviewCommentRequestDto,
  SendSessionReviewCommentsRequestDto
} from "@/dtos/reviewComment.dto.ts";

export class ReviewCommentController extends Context.Service<ReviewCommentController>()(
  "aggregor-app/presentation/controllers/reviewComment.controller/ReviewCommentController",
  {
    make: Effect.fn("ReviewCommentController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const reviewCommentService = yield* ReviewCommentService;
      const reviewCommentErrorMessage = yield* ReviewCommentErrorMessage;

      const addWrittenReviewComment = Effect.fn("ReviewCommentController.addWrittenReviewComment")(function* (
        request: AddReviewCommentRequestDto
      ) {
        yield* reviewCommentService.addReviewComment(request);
      });

      const editChosenReviewComment = Effect.fn("ReviewCommentController.editChosenReviewComment")(function* (
        request: EditReviewCommentRequestDto
      ) {
        yield* reviewCommentService.editReviewComment(request);
      });

      const removeChosenReviewComment = Effect.fn("ReviewCommentController.removeChosenReviewComment")(function* (
        request: RemoveReviewCommentRequestDto
      ) {
        yield* reviewCommentService.removeReviewComment(request);
      });

      const moveShownReviewComment = Effect.fn("ReviewCommentController.moveShownReviewComment")(function* (
        request: MoveReviewCommentRequestDto
      ) {
        yield* reviewCommentService.moveReviewComment(request);
      });

      const sendPendingReviewComments = Effect.fn("ReviewCommentController.sendPendingReviewComments")(function* () {
        yield* reviewCommentService.sendReviewComments;
      });

      const sendChosenSessionReviewComments = Effect.fn("ReviewCommentController.sendChosenSessionReviewComments")(
        function* (request: SendSessionReviewCommentsRequestDto) {
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

      yield* registerCommandMiddleware.registerCommand({
        commandId: REVIEW_COMMENT_COMMANDS.ADD,
        controller: addWrittenReviewComment,
        getCommandErrorMessage: reviewCommentErrorMessage.getReviewCommentCommandErrorMessage,
        requestSchema: AddReviewCommentRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: REVIEW_COMMENT_COMMANDS.EDIT,
        controller: editChosenReviewComment,
        getCommandErrorMessage: reviewCommentErrorMessage.getReviewCommentCommandErrorMessage,
        requestSchema: EditReviewCommentRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: REVIEW_COMMENT_COMMANDS.REMOVE,
        controller: removeChosenReviewComment,
        getCommandErrorMessage: reviewCommentErrorMessage.getReviewCommentCommandErrorMessage,
        requestSchema: RemoveReviewCommentRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: REVIEW_COMMENT_COMMANDS.MOVE,
        controller: moveShownReviewComment,
        getCommandErrorMessage: reviewCommentErrorMessage.getReviewCommentCommandErrorMessage,
        requestSchema: MoveReviewCommentRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommandWithoutRequest({
        commandId: REVIEW_COMMENT_COMMANDS.SEND,
        controller: sendPendingReviewComments,
        getCommandErrorMessage: reviewCommentErrorMessage.getReviewCommentCommandErrorMessage
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: REVIEW_COMMENT_COMMANDS.SEND_TO_SESSION,
        controller: sendChosenSessionReviewComments,
        getCommandErrorMessage: reviewCommentErrorMessage.getReviewCommentCommandErrorMessage,
        requestSchema: SendSessionReviewCommentsRequestDtoSchema
      });

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
