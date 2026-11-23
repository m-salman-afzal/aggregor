import {Schema} from "effect";

import {EntityIdValueObjectSchema} from "@/valueObjects/entityId.valueObject.ts";

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

export const MoveReviewCommentRequestDtoSchema = Schema.Struct({
  endLine: Schema.Int,
  reviewCommentId: EntityIdValueObjectSchema,
  startLine: Schema.Int
});

export type MoveReviewCommentRequestDto = typeof MoveReviewCommentRequestDtoSchema.Type;

export const SendSessionReviewCommentsRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type SendSessionReviewCommentsRequestDto = typeof SendSessionReviewCommentsRequestDtoSchema.Type;
