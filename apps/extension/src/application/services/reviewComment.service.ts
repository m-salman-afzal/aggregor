import {ReviewCommentDomainService} from "@domainServices/reviewComment.domainService.ts";
import {ReviewCommentChangeDtoSchema, ReviewCommentDtoSchema} from "@dtos/reviewComment.dto.ts";
import {IReviewCommentRepository} from "@entities/reviewComment/reviewComment.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {BaseService} from "@services/base.service.ts";
import {SessionService} from "@services/session.service.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {Array, Context, DateTime, Effect, Layer, Order, Schema, Stream} from "effect";

import type {
  AddReviewCommentRequestDto,
  EditReviewCommentRequestDto,
  MoveReviewCommentRequestDto,
  RemoveReviewCommentRequestDto,
  SendSessionReviewCommentsRequestDto
} from "@dtos/reviewComment.dto.ts";
import type {EntityChange} from "@entities/base/base.repository.interface.ts";
import type {ReviewCommentEntity} from "@entities/reviewComment/reviewComment.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";

export class ReviewCommentServiceErrors extends TaggedErrors({
  NoReviewCommentsError: {},
  NoSessionForReviewCommentsError: {},
  SessionAgentNotRunningError: {sessionDisplayName: Schema.String},
  SessionNotShownError: {cause: Schema.Unknown, sessionDisplayName: Schema.String}
}) {}

export class ReviewCommentService extends Context.Service<ReviewCommentService>()(
  "aggregor-app/application/services/reviewComment.service/ReviewCommentService",
  {
    make: Effect.fn("ReviewCommentService.make")(function* () {
      const reviewCommentRepository = yield* IReviewCommentRepository;
      const sessionRepository = yield* ISessionRepository;
      const tmuxInfraService = yield* ITmuxInfraService;
      const reviewCommentDomainService = yield* ReviewCommentDomainService;
      const sessionService = yield* SessionService;
      const baseService = yield* BaseService;
      const reviewCommentBaseService = yield* baseService.makeFor(reviewCommentRepository);
      const sessionBaseService = yield* baseService.makeFor(sessionRepository);

      const makeReviewCommentDto = Effect.fn("ReviewCommentService.makeReviewCommentDto")(function* (
        reviewComment: ReviewCommentEntity
      ) {
        return ReviewCommentDtoSchema.make({
          body: reviewComment.body,
          endLine: reviewComment.endLine,
          filePath: reviewComment.filePath,
          reviewCommentId: reviewComment.id,
          startLine: reviewComment.startLine
        });
      });

      const listReviewComments = Effect.fn("ReviewCommentService.listReviewComments")(function* () {
        const reviewComments = yield* reviewCommentBaseService.findEntities({});

        return yield* Effect.forEach(reviewComments, (reviewComment) => makeReviewCommentDto(reviewComment));
      });

      const makeReviewCommentChange = Effect.fn("ReviewCommentService.makeReviewCommentChange")(function* (
        reviewCommentChange: EntityChange<ReviewCommentEntity>
      ) {
        if (reviewCommentChange.kind === ENTITY_CHANGE_KINDS.REMOVED)
          return ReviewCommentChangeDtoSchema.cases.ReviewCommentRemoved.make({
            reviewCommentId: reviewCommentChange.entity.id
          });

        return ReviewCommentChangeDtoSchema.cases.ReviewCommentSaved.make({
          reviewComment: yield* makeReviewCommentDto(reviewCommentChange.entity)
        });
      });

      const watchReviewCommentChanges = Effect.fn("ReviewCommentService.watchReviewCommentChanges")(function* () {
        return Stream.mapEffect(reviewCommentRepository.entityChanges, (reviewCommentChange) =>
          makeReviewCommentChange(reviewCommentChange)
        );
      });

      const addReviewComment = Effect.fn("ReviewCommentService.addReviewComment")(function* (
        request: AddReviewCommentRequestDto
      ) {
        yield* reviewCommentBaseService.addEntity({
          body: request.body,
          endLine: request.endLine,
          filePath: request.filePath,
          startLine: request.startLine
        });
      });

      const editReviewComment = Effect.fn("ReviewCommentService.editReviewComment")(
        function* (request: EditReviewCommentRequestDto) {
          yield* reviewCommentBaseService.updateEntity(request.reviewCommentId, {body: request.body});
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      const removeReviewComment = Effect.fn("ReviewCommentService.removeReviewComment")(function* (
        request: RemoveReviewCommentRequestDto
      ) {
        yield* reviewCommentBaseService.removeEntity(request.reviewCommentId);
      });

      const moveReviewComment = Effect.fn("ReviewCommentService.moveReviewComment")(
        function* (request: MoveReviewCommentRequestDto) {
          yield* reviewCommentBaseService.updateEntity(request.reviewCommentId, {
            endLine: request.endLine,
            startLine: request.startLine
          });
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      const findPendingReviewComments = Effect.fn("ReviewCommentService.findPendingReviewComments")(function* () {
        const pendingReviewComments = yield* reviewCommentBaseService.findEntities({});
        if (pendingReviewComments.length === 0) return yield* ReviewCommentServiceErrors.NoReviewCommentsError.make();

        return pendingReviewComments;
      });

      const hasReviewCommentsInFolder = Effect.fn("ReviewCommentService.hasReviewCommentsInFolder")(function* (
        pendingReviewComments: readonly ReviewCommentEntity[],
        session: SessionEntity
      ) {
        const folderReviewComments = yield* reviewCommentDomainService.findReviewCommentsInFolder(
          pendingReviewComments,
          session.workingFolderPath
        );

        return folderReviewComments.length > 0;
      });

      const findReviewTargetSession = Effect.fn("ReviewCommentService.findReviewTargetSession")(function* (
        pendingReviewComments: readonly ReviewCommentEntity[]
      ) {
        const ongoingSessions = yield* sessionBaseService.findEntities({lifecycle: SESSION_LIFECYCLES.ONGOING});
        const viewedSessions = Array.filter(ongoingSessions, (ongoingSession) => ongoingSession.viewedAt !== undefined);
        const candidateSessions = yield* Effect.filter(viewedSessions, (viewedSession) =>
          hasReviewCommentsInFolder(pendingReviewComments, viewedSession)
        );
        const [latestViewedSession] = Array.sort(
          candidateSessions,
          Order.flip(
            Order.mapInput(Order.Number, (candidateSession: SessionEntity) =>
              candidateSession.viewedAt === undefined ? 0 : DateTime.toEpochMillis(candidateSession.viewedAt)
            )
          )
        );
        if (latestViewedSession === undefined)
          return yield* ReviewCommentServiceErrors.NoSessionForReviewCommentsError.make();

        return latestViewedSession;
      });

      const pasteReviewPrompt = Effect.fn("ReviewCommentService.pasteReviewPrompt")(
        function* (targetSession: SessionEntity, sentReviewComments: readonly ReviewCommentEntity[]) {
          const reviewPrompt = yield* reviewCommentDomainService.formatReviewPrompt(
            sentReviewComments,
            targetSession.workingFolderPath
          );

          yield* tmuxInfraService.pasteTextIntoSessionAgent(targetSession.id, reviewPrompt);
        },
        (effect, targetSession) =>
          Effect.catchTag(effect, "TmuxSessionNotRunningError", () =>
            Effect.fail(
              ReviewCommentServiceErrors.SessionAgentNotRunningError.make({
                sessionDisplayName: targetSession.displayName
              })
            )
          )
      );

      const showReviewTargetSession = Effect.fn("ReviewCommentService.showReviewTargetSession")(
        function* (targetSession: SessionEntity) {
          yield* sessionService.openSession({sessionId: targetSession.id});
        },
        (effect, targetSession) =>
          Effect.mapError(effect, (cause) =>
            ReviewCommentServiceErrors.SessionNotShownError.make({
              cause,
              sessionDisplayName: targetSession.displayName
            })
          )
      );

      const findSentReviewComments = Effect.fn("ReviewCommentService.findSentReviewComments")(function* (
        targetSession: SessionEntity,
        pendingReviewComments: readonly ReviewCommentEntity[]
      ) {
        const sentReviewComments = yield* reviewCommentDomainService.findReviewCommentsInFolder(
          pendingReviewComments,
          targetSession.workingFolderPath
        );
        if (sentReviewComments.length === 0) return yield* ReviewCommentServiceErrors.NoReviewCommentsError.make();

        return sentReviewComments;
      });

      const sendFolderReviewComments = Effect.fn("ReviewCommentService.sendFolderReviewComments")(function* (
        targetSession: SessionEntity,
        pendingReviewComments: readonly ReviewCommentEntity[]
      ) {
        const sentReviewComments = yield* findSentReviewComments(targetSession, pendingReviewComments);
        yield* Effect.annotateCurrentSpan({
          sentReviewCommentCount: sentReviewComments.length,
          sessionId: targetSession.id
        });

        yield* pasteReviewPrompt(targetSession, sentReviewComments);
        yield* Effect.forEach(sentReviewComments, (sentReviewComment) =>
          reviewCommentBaseService.removeEntity(sentReviewComment.id)
        );
        yield* showReviewTargetSession(targetSession);
      });

      const sendReviewComments = Effect.fn("ReviewCommentService.sendReviewComments")(function* () {
        const pendingReviewComments = yield* findPendingReviewComments();
        const targetSession = yield* findReviewTargetSession(pendingReviewComments);

        yield* sendFolderReviewComments(targetSession, pendingReviewComments);
      });

      const sendSessionReviewComments = Effect.fn("ReviewCommentService.sendSessionReviewComments")(
        function* (request: SendSessionReviewCommentsRequestDto) {
          const targetSession = yield* sessionBaseService.findEntityById(request.sessionId);
          const pendingReviewComments = yield* findPendingReviewComments();

          yield* sendFolderReviewComments(targetSession, pendingReviewComments);
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      return {
        addReviewComment,
        editReviewComment,
        listReviewComments: listReviewComments(),
        moveReviewComment,
        removeReviewComment,
        sendReviewComments: sendReviewComments(),
        sendSessionReviewComments,
        watchReviewCommentChanges: watchReviewCommentChanges()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([BaseService.layer, SessionService.layer])
  );
}
