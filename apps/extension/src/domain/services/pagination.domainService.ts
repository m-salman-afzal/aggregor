import {PaginationValueObjectSchema} from "@valueObjects/pagination.valueObject.ts";
import {Context, Effect, Layer} from "effect";

import type {PaginationValueObject} from "@valueObjects/pagination.valueObject.ts";

export class PaginationDomainService extends Context.Service<PaginationDomainService>()(
  "aggregor-app/domain/services/pagination.domainService/PaginationDomainService",
  {
    make: Effect.fn("PaginationDomainService.make")(function* () {
      const makePagination = Effect.fn("PaginationDomainService.makePagination")(function* (
        pageRequest: Pick<PaginationValueObject, "afterCursor" | "pageSize">,
        rowCounts: Pick<PaginationValueObject, "precedingCount" | "totalCount">,
        lastCursor: string | undefined
      ) {
        const pageEntityCount = Math.min(
          pageRequest.pageSize,
          Math.max(0, rowCounts.totalCount - rowCounts.precedingCount)
        );
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

      return {makePagination};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
