import {Context, Effect, Layer} from "effect";

import {ReviewCommentEntity} from "@/entities/reviewComment/reviewComment.entity.ts";
import {IReviewCommentRepository} from "@/entities/reviewComment/reviewComment.repository.interface.ts";
import {ReviewCommentTableModel} from "@/models/reviewComment.model.ts";
import {BaseRepository} from "@/repositories/base/base.repository.ts";

import type {AddReviewCommentRequest} from "@/entities/reviewComment/reviewComment.repository.interface.ts";

export class ReviewCommentRepository extends Context.Service<ReviewCommentRepository>()(
  "aggregor-app/infrastructure/repositories/reviewComment.repository/ReviewCommentRepository",
  {
    make: Effect.fn("ReviewCommentRepository.make")(function* () {
      const baseRepository = yield* BaseRepository;

      return yield* baseRepository.makeForTable<ReviewCommentEntity, AddReviewCommentRequest>({
        entitySchema: ReviewCommentEntity,
        tableModel: ReviewCommentTableModel
      });
    })
  }
) {
  public static readonly layer = Layer.effect(IReviewCommentRepository, this.make()).pipe(
    Layer.provide(BaseRepository.layer)
  );
}
