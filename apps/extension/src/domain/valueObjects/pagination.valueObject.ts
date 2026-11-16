import {Schema} from "effect";

// A cursor is a page's last row's sortId, opaque outside the repository; nextCursor exists only while a page follows.
export const PaginationValueObjectSchema = Schema.Struct({
  afterCursor: Schema.optional(Schema.String),
  hasNextPage: Schema.Boolean,
  nextCursor: Schema.optional(Schema.String),
  pageNumber: Schema.Int,
  pageSize: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  precedingCount: Schema.Int,
  remainingCount: Schema.Int,
  totalCount: Schema.Int,
  totalPages: Schema.Int
});

export type PaginationValueObject = typeof PaginationValueObjectSchema.Type;
