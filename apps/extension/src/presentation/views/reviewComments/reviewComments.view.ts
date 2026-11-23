import {Array, Context, Effect, Layer, Match, Ref, Schema, Stream, String} from "effect";

import {ReviewCommentController} from "@/controllers/reviewComment.controller.ts";
import {
  REVIEW_COMMENT_COMMANDS,
  REVIEW_COMMENTS_VIEW,
  REVIEW_COMMENTS_VIEW_GESTURES
} from "@pkg/constants/src/reviewComment.constant.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

import type {
  Comment,
  CommentReply,
  CommentThread,
  Range,
  TextDocument,
  TextDocumentChangeEvent,
  TextDocumentContentChangeEvent
} from "vscode";

import type {ReviewCommentChangeDto, ReviewCommentDto} from "@/dtos/reviewComment.dto.ts";

interface ReviewCommentThreadComment extends Comment {
  readonly body: string;
  readonly reviewCommentId: ReviewCommentDto["reviewCommentId"];
  readonly savedBody: string;
}

interface ShownReviewComment {
  readonly savedBody: string;
  readonly savedEndLine: number;
  readonly savedStartLine: number;
  readonly thread: CommentThread;
}

type ShownReviewComments = Ref.Ref<ReadonlyMap<ReviewCommentDto["reviewCommentId"], ShownReviewComment>>;

class ReviewCommentsViewErrors extends TaggedErrors({
  ReviewCommentCommandFailedError: {cause: Schema.Unknown, commandId: Schema.String},
  ReviewCommentThreadNotShownError: {reviewCommentId: Schema.String}
}) {}

export class ReviewCommentsView extends Context.Service<ReviewCommentsView>()(
  "aggregor-app/presentation/views/reviewComments/reviewComments.view/ReviewCommentsView",
  {
    make: Effect.fn("ReviewCommentsView.make")(function* () {
      const reviewCommentController = yield* ReviewCommentController;
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const commentController = yield* vscodeUtils.acquireScopedDisposable(() =>
        vsCodeApi.comments.createCommentController(
          REVIEW_COMMENTS_VIEW.CONTROLLER_ID,
          REVIEW_COMMENTS_VIEW.CONTROLLER_LABEL
        )
      );
      const shownReviewComments: ShownReviewComments = yield* Ref.make<
        ReadonlyMap<ReviewCommentDto["reviewCommentId"], ShownReviewComment>
      >(new Map());

      const setUpCommentController = Effect.fn("ReviewCommentsView.setUpCommentController")(function* () {
        yield* Effect.sync(() => {
          commentController.commentingRangeProvider = {
            provideCommentingRanges: (commentedDocument: TextDocument) =>
              commentedDocument.uri.scheme === REVIEW_COMMENTS_VIEW.COMMENTABLE_URI_SCHEME
                ? [new vsCodeApi.Range(0, 0, commentedDocument.lineCount - 1, 0)]
                : []
          };
          commentController.options = {
            placeHolder: REVIEW_COMMENTS_VIEW.DRAFT_PLACEHOLDER,
            prompt: REVIEW_COMMENTS_VIEW.DRAFT_PROMPT
          };
        });
      });

      const findShownReviewCommentThread = Effect.fn("ReviewCommentsView.findShownReviewCommentThread")(function* (
        reviewCommentId: ReviewCommentDto["reviewCommentId"]
      ) {
        const shownReviewCommentsById = yield* Ref.get(shownReviewComments);
        const shownReviewComment = shownReviewCommentsById.get(reviewCommentId);
        if (shownReviewComment === undefined)
          return yield* ReviewCommentsViewErrors.ReviewCommentThreadNotShownError.make({reviewCommentId});

        return shownReviewComment.thread;
      });

      const rememberDrawnReviewComment = Effect.fn("ReviewCommentsView.rememberDrawnReviewComment")(function* (
        reviewComment: ReviewCommentDto,
        shownThread: CommentThread
      ) {
        const shownReviewComment: ShownReviewComment = {
          savedBody: reviewComment.body,
          savedEndLine: reviewComment.endLine,
          savedStartLine: reviewComment.startLine,
          thread: shownThread
        };
        yield* Ref.update(
          shownReviewComments,
          (shownReviewCommentsById) =>
            new Map([...shownReviewCommentsById, [reviewComment.reviewCommentId, shownReviewComment]])
        );
      });

      const makeThreadComment = Effect.fn("ReviewCommentsView.makeThreadComment")(function* (
        reviewComment: ReviewCommentDto
      ) {
        const threadComment: ReviewCommentThreadComment = {
          author: {name: REVIEW_COMMENTS_VIEW.AUTHOR_NAME},
          body: reviewComment.body,
          mode: vsCodeApi.CommentMode.Preview,
          reviewCommentId: reviewComment.reviewCommentId,
          savedBody: reviewComment.body
        };

        return threadComment;
      });

      const createReviewCommentThread = Effect.fn("ReviewCommentsView.createReviewCommentThread")(function* (
        reviewComment: ReviewCommentDto
      ) {
        const threadRange = new vsCodeApi.Range(
          reviewComment.startLine - 1,
          0,
          reviewComment.endLine - 1,
          REVIEW_COMMENTS_VIEW.LINE_END_CHARACTER
        );
        const threadComment = yield* makeThreadComment(reviewComment);
        const newThread = yield* Effect.sync(() => {
          const createdThread = commentController.createCommentThread(
            vsCodeApi.Uri.file(reviewComment.filePath),
            threadRange,
            [threadComment]
          );
          createdThread.canReply = false;

          return createdThread;
        });
        yield* rememberDrawnReviewComment(reviewComment, newThread);
      });

      // Setting the thread's comments closes an edit the user has open, so a comment that only moved keeps them.
      const redrawUnlessOnlyMoved = Effect.fn("ReviewCommentsView.redrawUnlessOnlyMoved")(function* (
        reviewComment: ReviewCommentDto,
        shownReviewComment: ShownReviewComment
      ) {
        const hasMoved =
          reviewComment.startLine !== shownReviewComment.savedStartLine ||
          reviewComment.endLine !== shownReviewComment.savedEndLine;
        if (hasMoved && reviewComment.body === shownReviewComment.savedBody) return;
        const threadComment = yield* makeThreadComment(reviewComment);

        yield* Effect.sync(() => {
          shownReviewComment.thread.comments = [threadComment];
        });
      });

      // A shown thread keeps its range: this window moves it with its file's edits, ahead of the stored lines.
      const drawReviewComment = Effect.fn("ReviewCommentsView.drawReviewComment")(function* (
        reviewComment: ReviewCommentDto
      ) {
        const shownReviewCommentsById = yield* Ref.get(shownReviewComments);
        const shownReviewComment = shownReviewCommentsById.get(reviewComment.reviewCommentId);
        if (shownReviewComment === undefined) return yield* createReviewCommentThread(reviewComment);

        yield* redrawUnlessOnlyMoved(reviewComment, shownReviewComment);

        return yield* rememberDrawnReviewComment(reviewComment, shownReviewComment.thread);
      });

      const sumLineShifts = Effect.fn("ReviewCommentsView.sumLineShifts")(function* (
        contentChanges: readonly TextDocumentContentChangeEvent[]
      ) {
        return Array.reduce(
          contentChanges,
          0,
          (lineShift, contentChange) =>
            lineShift +
            (String.split(REVIEW_COMMENTS_VIEW.LINE_BREAK)(contentChange.text).length - 1) -
            (contentChange.range.end.line - contentChange.range.start.line)
        );
      });

      // An edit that reaches past the thread's lines on either side can't say where they went, so it moves nothing.
      const shiftLineRangeWithContentChanges = Effect.fn("ReviewCommentsView.shiftLineRangeWithContentChanges")(
        function* (threadRange: Range, contentChanges: readonly TextDocumentContentChangeEvent[]) {
          const isAboveThread = (contentChange: TextDocumentContentChangeEvent) =>
            contentChange.range.end.line < threadRange.start.line ||
            (contentChange.range.end.line === threadRange.start.line && contentChange.range.end.character === 0);
          const changesAboveThread = Array.filter(contentChanges, isAboveThread);
          const changesInsideThread = Array.filter(
            contentChanges,
            (contentChange) =>
              !isAboveThread(contentChange) &&
              contentChange.range.start.line >= threadRange.start.line &&
              contentChange.range.end.line <= threadRange.end.line
          );
          const startLine = Math.max(threadRange.start.line + (yield* sumLineShifts(changesAboveThread)), 0);
          const endLine =
            threadRange.end.line + (yield* sumLineShifts([...changesAboveThread, ...changesInsideThread]));

          return new vsCodeApi.Range(
            startLine,
            0,
            Math.max(startLine, endLine),
            REVIEW_COMMENTS_VIEW.LINE_END_CHARACTER
          );
        }
      );

      const moveShownThread = Effect.fn("ReviewCommentsView.moveShownThread")(function* (
        shownThread: CommentThread,
        contentChanges: readonly TextDocumentContentChangeEvent[]
      ) {
        const shownRange = shownThread.range;
        if (shownRange === undefined) return;
        const movedRange = yield* shiftLineRangeWithContentChanges(shownRange, contentChanges);
        if (movedRange.isEqual(shownRange)) return;

        yield* Effect.sync(() => {
          shownThread.range = movedRange;
        });
      });

      // VS Code moves a thread's mark in the gutter with its file's edits, but leaves the thread's range on the old lines.
      const moveShownThreadsWithDocumentChange = Effect.fn("ReviewCommentsView.moveShownThreadsWithDocumentChange")(
        function* (documentChange: TextDocumentChangeEvent) {
          const changedDocumentUri = documentChange.document.uri.toString();
          const shownReviewCommentsById = yield* Ref.get(shownReviewComments);
          const threadsInDocument = Array.filter(
            Array.map([...shownReviewCommentsById.values()], (shownReviewComment) => shownReviewComment.thread),
            (shownThread) => shownThread.uri.toString() === changedDocumentUri
          );

          yield* Effect.forEach(threadsInDocument, (shownThread) =>
            moveShownThread(shownThread, documentChange.contentChanges)
          );
        }
      );

      const eraseReviewComment = Effect.fn("ReviewCommentsView.eraseReviewComment")(function* (
        reviewCommentId: ReviewCommentDto["reviewCommentId"]
      ) {
        const shownReviewCommentsById = yield* Ref.get(shownReviewComments);
        const shownReviewComment = shownReviewCommentsById.get(reviewCommentId);
        if (shownReviewComment === undefined) return;

        yield* Effect.sync(() => {
          shownReviewComment.thread.dispose();
        });
        yield* Ref.update(
          shownReviewComments,
          (shownReviewCommentsByIdNow) =>
            new Map(
              Array.filter(
                [...shownReviewCommentsByIdNow],
                ([shownReviewCommentId]) => shownReviewCommentId !== reviewCommentId
              )
            )
        );
      });

      const drawReviewCommentChange = Effect.fn("ReviewCommentsView.drawReviewCommentChange")(function* (
        reviewCommentChange: ReviewCommentChangeDto
      ) {
        yield* Match.valueTags(reviewCommentChange, {
          ReviewCommentRemoved: (reviewCommentRemoved) => eraseReviewComment(reviewCommentRemoved.reviewCommentId),
          ReviewCommentSaved: (reviewCommentSaved) => drawReviewComment(reviewCommentSaved.reviewComment)
        });
      });

      const drawPendingReviewComments = Effect.fn("ReviewCommentsView.drawPendingReviewComments")(
        function* () {
          const pendingReviewComments = yield* reviewCommentController.listReviewCommentsForReviewCommentsView;
          yield* Effect.forEach(pendingReviewComments, (pendingReviewComment) =>
            drawReviewComment(pendingReviewComment)
          );
        },
        Effect.catch((readError) => Effect.logWarning("Could not draw the pending review comments", readError))
      );

      // A controller's command shows its own failure and still resolves; the change stream draws what it saved.
      const runReviewCommentCommand = Effect.fn("ReviewCommentsView.runReviewCommentCommand")(function* (
        commandId: string,
        commandArgument: unknown
      ) {
        yield* Effect.annotateCurrentSpan({commandId});

        yield* Effect.tryPromise({
          catch: (cause) => ReviewCommentsViewErrors.ReviewCommentCommandFailedError.make({cause, commandId}),
          try: () => vsCodeApi.commands.executeCommand(commandId, commandArgument)
        });
      });

      // The reply box is VS Code's own draft thread, and disposing it drops the focus it held, so the editor gets it back.
      const submitReviewCommentDraft = Effect.fn("ReviewCommentsView.submitReviewCommentDraft")(
        function* (commentReply: CommentReply) {
          const draftRange = commentReply.thread.range;
          if (draftRange === undefined) return;

          yield* runReviewCommentCommand(REVIEW_COMMENT_COMMANDS.ADD, {
            body: commentReply.text,
            endLine: draftRange.end.line + 1,
            filePath: commentReply.thread.uri.fsPath,
            startLine: draftRange.start.line + 1
          });
          yield* Effect.sync(() => {
            commentReply.thread.dispose();
          });
          yield* Effect.promise(() => vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.FOCUS_ACTIVE_EDITOR_GROUP));
        },
        Effect.catch((gestureError) => Effect.logWarning("Could not add the review comment", gestureError))
      );

      const startReviewCommentEdit = Effect.fn("ReviewCommentsView.startReviewCommentEdit")(
        function* (chosenComment: ReviewCommentThreadComment) {
          const shownThread = yield* findShownReviewCommentThread(chosenComment.reviewCommentId);
          yield* Effect.sync(() => {
            shownThread.comments = [{...chosenComment, mode: vsCodeApi.CommentMode.Editing}];
          });
        },
        Effect.catch((gestureError) => Effect.logWarning("Could not start editing the review comment", gestureError))
      );

      // VS Code has already written the edited text into the comment's body.
      const cancelReviewCommentEdit = Effect.fn("ReviewCommentsView.cancelReviewCommentEdit")(
        function* (chosenComment: ReviewCommentThreadComment) {
          const shownThread = yield* findShownReviewCommentThread(chosenComment.reviewCommentId);
          yield* Effect.sync(() => {
            shownThread.comments = [
              {...chosenComment, body: chosenComment.savedBody, mode: vsCodeApi.CommentMode.Preview}
            ];
          });
        },
        Effect.catch((gestureError) => Effect.logWarning("Could not cancel editing the review comment", gestureError))
      );

      const saveShownThreadMove = Effect.fn("ReviewCommentsView.saveShownThreadMove")(function* (
        reviewCommentId: ReviewCommentDto["reviewCommentId"],
        shownReviewComment: ShownReviewComment
      ) {
        const shownRange = shownReviewComment.thread.range;
        if (shownRange === undefined) return;
        const startLine = shownRange.start.line + 1;
        const endLine = shownRange.end.line + 1;
        if (startLine === shownReviewComment.savedStartLine && endLine === shownReviewComment.savedEndLine) return;

        yield* runReviewCommentCommand(REVIEW_COMMENT_COMMANDS.MOVE, {endLine, reviewCommentId, startLine});
      });

      const saveShownThreadMoves = Effect.fn("ReviewCommentsView.saveShownThreadMoves")(
        function* () {
          const shownReviewCommentsById = yield* Ref.get(shownReviewComments);
          yield* Effect.forEach([...shownReviewCommentsById], ([reviewCommentId, shownReviewComment]) =>
            saveShownThreadMove(reviewCommentId, shownReviewComment)
          );
        },
        Effect.catch((saveError) => Effect.logWarning("Could not save the moved review comments", saveError))
      );

      // Every keystroke in a file fires this, and the trace log is a document too, so it runs untraced.
      const startShownThreadMoves = Effect.fn("ReviewCommentsView.startShownThreadMoves")(function* () {
        const documentChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.workspace.onDidChangeTextDocument);
        const commentableDocumentChanges = Stream.filter(
          documentChanges,
          (documentChange) =>
            documentChange.document.uri.scheme === REVIEW_COMMENTS_VIEW.COMMENTABLE_URI_SCHEME &&
            documentChange.contentChanges.length > 0
        );
        const movedDocumentChanges = Stream.tap(commentableDocumentChanges, (documentChange) =>
          Effect.withTracerEnabled(moveShownThreadsWithDocumentChange(documentChange), false)
        );

        yield* Effect.forkScoped(
          Stream.runForEach(Stream.debounce(movedDocumentChanges, REVIEW_COMMENTS_VIEW.MOVED_LINES_SAVE_DELAY), () =>
            Effect.withTracerEnabled(saveShownThreadMoves(), false)
          )
        );
      });

      const registerGestures = Effect.fn("ReviewCommentsView.registerGestures")(function* () {
        const viewContext = yield* Effect.context<VsCodeApi>();
        const runPromise = Effect.runPromiseWith(viewContext);

        yield* vscodeUtils.acquireScopedDisposable(() =>
          vsCodeApi.commands.registerCommand(
            REVIEW_COMMENTS_VIEW_GESTURES.CANCEL_EDIT,
            (chosenComment: ReviewCommentThreadComment) => runPromise(cancelReviewCommentEdit(chosenComment))
          )
        );
        yield* vscodeUtils.acquireScopedDisposable(() =>
          vsCodeApi.commands.registerCommand(
            REVIEW_COMMENTS_VIEW_GESTURES.START_EDIT,
            (chosenComment: ReviewCommentThreadComment) => runPromise(startReviewCommentEdit(chosenComment))
          )
        );
        yield* vscodeUtils.acquireScopedDisposable(() =>
          vsCodeApi.commands.registerCommand(REVIEW_COMMENTS_VIEW_GESTURES.SUBMIT_DRAFT, (commentReply: CommentReply) =>
            runPromise(submitReviewCommentDraft(commentReply))
          )
        );
      });

      yield* setUpCommentController();
      yield* registerGestures();
      yield* startShownThreadMoves();
      const reviewCommentChanges = yield* reviewCommentController.watchReviewCommentChangesForReviewCommentsView;

      yield* Effect.forkScoped(
        Stream.runForEach(reviewCommentChanges, (reviewCommentChange) => drawReviewCommentChange(reviewCommentChange))
      );
      yield* drawPendingReviewComments();

      return {};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(ReviewCommentController.layer));
}
