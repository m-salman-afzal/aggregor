import {Array, Context, Effect, Layer, Order, String} from "effect";

import type {ReviewCommentEntity} from "@/entities/reviewComment/reviewComment.entity.ts";
import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";

const FOLDER_PATH_SEPARATOR = "/";
const REVIEW_PROMPT_CITE_PREFIX = "cite: ";
const REVIEW_PROMPT_LINE_RANGE_SEPARATOR = ":";
const REVIEW_PROMPT_LINE_SEPARATOR = "\n";
const REVIEW_PROMPT_BLOCK_SEPARATOR = "\n\n";

const ReviewCommentPromptOrder = Order.combine(
  Order.mapInput(Order.String, (reviewComment: ReviewCommentEntity) => reviewComment.filePath),
  Order.mapInput(Order.Number, (reviewComment: ReviewCommentEntity) => reviewComment.startLine)
);

export class ReviewCommentDomainService extends Context.Service<ReviewCommentDomainService>()(
  "aggregor-app/domain/services/reviewComment.domainService/ReviewCommentDomainService",
  {
    make: Effect.fn("ReviewCommentDomainService.make")(function* () {
      const findReviewCommentsInFolder = Effect.fn("ReviewCommentDomainService.findReviewCommentsInFolder")(function* (
        reviewComments: readonly ReviewCommentEntity[],
        folderPath: ProjectPathValueObject
      ) {
        const folderPathPrefix = `${folderPath}${FOLDER_PATH_SEPARATOR}`;

        return Array.filter(reviewComments, (reviewComment) =>
          String.startsWith(folderPathPrefix)(reviewComment.filePath)
        );
      });

      const formatReviewPromptBlock = Effect.fn("ReviewCommentDomainService.formatReviewPromptBlock")(function* (
        reviewComment: ReviewCommentEntity,
        folderPath: ProjectPathValueObject
      ) {
        const relativeFilePath = String.slice(`${folderPath}${FOLDER_PATH_SEPARATOR}`.length)(reviewComment.filePath);
        const citeLine = `${REVIEW_PROMPT_CITE_PREFIX}${relativeFilePath}${REVIEW_PROMPT_LINE_RANGE_SEPARATOR}${reviewComment.lineRange}`;

        return `${citeLine}${REVIEW_PROMPT_LINE_SEPARATOR}${reviewComment.body}`;
      });

      const formatReviewPrompt = Effect.fn("ReviewCommentDomainService.formatReviewPrompt")(function* (
        reviewComments: readonly ReviewCommentEntity[],
        folderPath: ProjectPathValueObject
      ) {
        const orderedReviewComments = Array.sort(reviewComments, ReviewCommentPromptOrder);
        const reviewPromptBlocks = yield* Effect.forEach(orderedReviewComments, (reviewComment) =>
          formatReviewPromptBlock(reviewComment, folderPath)
        );

        return Array.join(reviewPromptBlocks, REVIEW_PROMPT_BLOCK_SEPARATOR);
      });

      return {findReviewCommentsInFolder, formatReviewPrompt};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
