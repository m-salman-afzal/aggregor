import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Schema} from "effect";

export const ReviewCommentDtoSchema = Schema.Struct({
  body: Schema.String,
  endLine: Schema.Int,
  filePath: Schema.String,
  reviewCommentId: EntityIdValueObjectSchema,
  startLine: Schema.Int
});

export type ReviewCommentDto = typeof ReviewCommentDtoSchema.Type;

export const ReviewCommentChangeDtoSchema = Schema.TaggedUnion({
  ReviewCommentRemoved: {reviewCommentId: EntityIdValueObjectSchema},
  ReviewCommentSaved: {reviewComment: ReviewCommentDtoSchema}
});

export type ReviewCommentChangeDto = typeof ReviewCommentChangeDtoSchema.Type;

export const AddReviewCommentRequestDtoSchema = Schema.Struct({
  body: Schema.NonEmptyString,
  endLine: Schema.Int,
  filePath: Schema.NonEmptyString,
  startLine: Schema.Int
});

export type AddReviewCommentRequestDto = typeof AddReviewCommentRequestDtoSchema.Type;

export const EditReviewCommentRequestDtoSchema = Schema.Struct({
  body: Schema.NonEmptyString,
  reviewCommentId: EntityIdValueObjectSchema
});

export type EditReviewCommentRequestDto = typeof EditReviewCommentRequestDtoSchema.Type;

export const RemoveReviewCommentRequestDtoSchema = Schema.Struct({reviewCommentId: EntityIdValueObjectSchema});

export type RemoveReviewCommentRequestDto = typeof RemoveReviewCommentRequestDtoSchema.Type;

export const ReviewCommentLineRangeDtoSchema = Schema.Struct({
  endLine: Schema.Int,
  reviewCommentId: EntityIdValueObjectSchema,
  startLine: Schema.Int
});

export type ReviewCommentLineRangeDto = typeof ReviewCommentLineRangeDtoSchema.Type;

export const SendReviewCommentsRequestDtoSchema = Schema.Struct({
  currentLineRanges: Schema.Array(ReviewCommentLineRangeDtoSchema)
});

export type SendReviewCommentsRequestDto = typeof SendReviewCommentsRequestDtoSchema.Type;
