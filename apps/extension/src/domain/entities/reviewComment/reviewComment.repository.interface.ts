import {Context} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {ReviewCommentEntity} from "@entities/reviewComment/reviewComment.entity.ts";

export type AddReviewCommentRequest = Pick<ReviewCommentEntity, "body" | "endLine" | "filePath" | "startLine">;

export class IReviewCommentRepository extends Context.Service<
  IReviewCommentRepository,
  IBaseRepository<ReviewCommentEntity, AddReviewCommentRequest>
>()("aggregor-app/domain/entities/reviewComment/reviewComment.repository.interface/IReviewCommentRepository") {}
