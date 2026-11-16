import {PaginationValueObjectSchema} from "@valueObjects/pagination.valueObject.ts";
import {Effect} from "effect";

import type {PaginationValueObject} from "@valueObjects/pagination.valueObject.ts";

// An empty list still has one page, the empty first one.
export const makePagination = Effect.fn("PaginationDomainService.makePagination")(function* (
  pageRequest: Pick<PaginationValueObject, "afterCursor" | "pageSize">,
  rowCounts: Pick<PaginationValueObject, "precedingCount" | "totalCount">,
  lastCursor: string | undefined
) {
  const pageEntityCount = Math.min(pageRequest.pageSize, Math.max(0, rowCounts.totalCount - rowCounts.precedingCount));
  const remainingCount = Math.max(0, rowCounts.totalCount - rowCounts.precedingCount - pageEntityCount);
  const hasNextPage = remainingCount > 0;

  return PaginationValueObjectSchema.make({
    ...(pageRequest.afterCursor === undefined ? {} : {afterCursor: pageRequest.afterCursor}),
    ...(hasNextPage && lastCursor !== undefined ? {nextCursor: lastCursor} : {}),
    hasNextPage,
    pageNumber: Math.floor(rowCounts.precedingCount / pageRequest.pageSize) + 1,
    pageSize: pageRequest.pageSize,
    precedingCount: rowCounts.precedingCount,
    remainingCount,
    totalCount: rowCounts.totalCount,
    totalPages: Math.max(1, Math.ceil(rowCounts.totalCount / pageRequest.pageSize))
  });
});
