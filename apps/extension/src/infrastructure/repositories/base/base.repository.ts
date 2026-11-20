import {DatabaseLayer} from "@di/database.layer.ts";
import {EntityIdDomainService} from "@domainServices/entityId.domainService.ts";
import {PaginationDomainService} from "@domainServices/pagination.domainService.ts";
import {BaseEntity} from "@entities/base/base.entity.ts";
import {IBaseRepositoryErrors} from "@entities/base/base.repository.interface.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {EntityChangeUtils} from "@repositories/base/entityChange.utils.ts";
import {RepositoryUtils} from "@repositories/base/repository.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {and, eq, gte, inArray, isNull, lt, sql} from "drizzle-orm";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {Array, Context, Effect, Layer, Queue, Record, Schema} from "effect";

import type {EntityPage, IBaseRepository, PageRequest} from "@entities/base/base.repository.interface.ts";
import type {EntityTable, StoredColumns} from "@repositories/base/base.repository.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {SQL} from "drizzle-orm";
import type {SQLiteColumn} from "drizzle-orm/sqlite-core";

// The cursor is the page's last row's sortId, so a row placed or moved meanwhile never shifts a page that follows.
const CursorSortIdSchema = Schema.NumberFromString.check(Schema.isInt());

export class BaseRepository extends Context.Service<BaseRepository>()(
  "aggregor-app/infrastructure/repositories/base/base.repository/BaseRepository",
  {
    make: Effect.fn("make")(function* () {
      const database = yield* makeWithDefaults();
      const repositoryUtils = yield* RepositoryUtils;
      const entityChangeUtils = yield* EntityChangeUtils;
      const entityIdDomainService = yield* EntityIdDomainService;
      const paginationDomainService = yield* PaginationDomainService;

      // Every write notifies the change feed, so this window's own writes show at once.
      const makeFor = Effect.fn("makeFor")(function* <Entity extends BaseEntity, AddRequest extends StoredColumns>(
        entityTable: EntityTable<Entity>
      ) {
        const findRows = Effect.fn("findRows")(
          function* (filter: StoredColumns) {
            const filterClauses = yield* repositoryUtils.makeFilterClauses(entityTable.tableModel, filter);
            const storedRows = yield* repositoryUtils.selectRows(
              entityTable,
              and(isNull(entityTable.tableModel.deletedAt), ...filterClauses),
              entityTable.tableModel.sortId
            );

            return yield* Effect.forEach(storedRows, (storedRow) =>
              BaseEntity.fromRow(entityTable.entitySchema, storedRow)
            );
          },
          Effect.mapError((cause) => IBaseRepositoryErrors.DatabaseReadError.make({cause}))
        );

        const decodeCursorSortId = Effect.fn("decodeCursorSortId")(function* (afterCursor: string | undefined) {
          return afterCursor === undefined ? undefined : yield* Schema.decodeEffect(CursorSortIdSchema)(afterCursor);
        });

        const countPageRows = Effect.fn("countPageRows")(function* (
          listedCondition: SQL | undefined,
          afterSortId: number | undefined
        ) {
          const totalCount = yield* repositoryUtils.countRows(entityTable, listedCondition);
          const precedingCount =
            afterSortId === undefined
              ? 0
              : yield* repositoryUtils.countRows(
                  entityTable,
                  and(listedCondition, gte(entityTable.tableModel.sortId, afterSortId))
                );

          return {precedingCount, totalCount};
        });

        const findRowPage = Effect.fn("findRowPage")(
          function* (filter: StoredColumns, pageRequest: PageRequest) {
            const filterClauses = yield* repositoryUtils.makeFilterClauses(entityTable.tableModel, filter);
            const listedCondition = and(isNull(entityTable.tableModel.deletedAt), ...filterClauses);
            const afterSortId = yield* decodeCursorSortId(pageRequest.afterCursor);
            const pageCounts = yield* countPageRows(listedCondition, afterSortId);
            const pageCondition =
              afterSortId === undefined
                ? listedCondition
                : and(listedCondition, lt(entityTable.tableModel.sortId, afterSortId));
            const pageRows = yield* repositoryUtils.selectRowPage(entityTable, pageCondition, pageRequest.pageSize);
            const entities = yield* Effect.forEach(pageRows, (pageRow) =>
              BaseEntity.fromRow(entityTable.entitySchema, pageRow)
            );
            const lastEntity = entities.at(-1);
            const lastCursor = lastEntity === undefined ? undefined : String(lastEntity.sortId);
            const entityPage: EntityPage<Entity> = {
              entities,
              pagination: yield* paginationDomainService.makePagination(pageRequest, pageCounts, lastCursor)
            };

            return entityPage;
          },
          Effect.mapError((cause) => IBaseRepositoryErrors.DatabaseReadError.make({cause}))
        );

        const findRowById = Effect.fn("findRowById")(function* (entityId: EntityIdValueObject) {
          const [foundEntity] = yield* findRows({id: entityId});
          if (foundEntity === undefined) return yield* IBaseRepositoryErrors.EntityNotFoundError.make({entityId});

          return foundEntity;
        });

        // AUTOINCREMENT needs an integer primary key, so sortId is MAX + 1, inside the writing statement.
        const writeRowAtEnd = Effect.fn("writeRowAtEnd")(function* (
          addRequest: StoredColumns,
          conflictColumns: readonly SQLiteColumn[]
        ) {
          const nextSortId = sql`(SELECT COALESCE(MAX(${entityTable.tableModel.sortId}), 0) + 1 FROM ${entityTable.tableModel})`;
          const updatedAt = yield* repositoryUtils.formatCurrentTimestamp;
          const storedColumns = {
            ...(yield* repositoryUtils.encodeStoredColumns(addRequest)),
            id: yield* entityIdDomainService.makeEntityId,
            sortId: nextSortId,
            updatedAt
          };
          const conflictColumnNames = Array.map(conflictColumns, (conflictColumn) => conflictColumn.name);
          const changedColumns = {
            ...Record.filter(
              storedColumns,
              (_columnValue, column) => column !== "id" && !conflictColumnNames.includes(column)
            ),
            deletedAt: null
          };
          const [writtenRow] = yield* database
            .insert(entityTable.tableModel)
            .values(storedColumns)
            .onConflictDoUpdate({set: changedColumns, target: [...conflictColumns]})
            .returning({id: entityTable.tableModel.id});
          if (writtenRow === undefined) return yield* Effect.die("A write returned no row");

          return yield* Schema.decodeUnknownEffect(EntityIdValueObjectSchema)(writtenRow.id);
        });

        const writeAndReadRow = Effect.fn("writeAndReadRow")(
          function* (addRequest: StoredColumns, conflictColumns: readonly SQLiteColumn[]) {
            const entityId = yield* Effect.mapError(writeRowAtEnd(addRequest, conflictColumns), (cause) =>
              IBaseRepositoryErrors.DatabaseWriteError.make({cause})
            );

            return yield* findRowById(entityId);
          },
          Effect.catchTag("EntityNotFoundError", (entityNotFound) =>
            Effect.fail(IBaseRepositoryErrors.DatabaseReadError.make({cause: entityNotFound}))
          )
        );

        // A conflict on the new id never happens, so this always inserts; a unique-column clash still fails.
        const addRow = Effect.fn("addRow")(function* (addRequest: StoredColumns) {
          return yield* writeAndReadRow(addRequest, [entityTable.tableModel.id]);
        });

        const upsertRow = Effect.fn("upsertRow")(function* (addRequest: StoredColumns) {
          const uniqueColumns = yield* repositoryUtils.findUniqueColumns(entityTable.tableModel);

          return yield* writeAndReadRow(addRequest, uniqueColumns);
        });

        const updateRow = Effect.fn("updateRow")(function* (entityId: EntityIdValueObject, changes: StoredColumns) {
          const encodedChanges = yield* Effect.mapError(repositoryUtils.encodeStoredColumns(changes), (cause) =>
            IBaseRepositoryErrors.DatabaseWriteError.make({cause})
          );
          const changedColumns = {...encodedChanges, updatedAt: yield* repositoryUtils.formatCurrentTimestamp};
          const updatedRows = Effect.mapError(
            database
              .update(entityTable.tableModel)
              .set(changedColumns)
              .where(and(eq(entityTable.tableModel.id, entityId), isNull(entityTable.tableModel.deletedAt)))
              .returning({id: entityTable.tableModel.id}),
            (cause) => IBaseRepositoryErrors.DatabaseWriteError.make({cause})
          );
          yield* Effect.filterOrFail(
            updatedRows,
            (updatedRowIds) => updatedRowIds.length > 0,
            () => IBaseRepositoryErrors.EntityNotFoundError.make({entityId})
          );
        });

        const softDeleteRow = Effect.fn("softDeleteRow")(
          function* (entityId: EntityIdValueObject) {
            const deletedAt = yield* repositoryUtils.formatCurrentTimestamp;
            yield* database
              .update(entityTable.tableModel)
              .set({deletedAt, updatedAt: deletedAt})
              .where(and(eq(entityTable.tableModel.id, entityId), isNull(entityTable.tableModel.deletedAt)));
          },
          Effect.mapError((cause) => IBaseRepositoryErrors.DatabaseWriteError.make({cause}))
        );

        // One statement reads the highest sortId once, so the rows take the sortIds after it in the order given.
        const placeRowsAtEnd = Effect.fn("placeRowsAtEnd")(
          function* (entityIds: readonly EntityIdValueObject[]) {
            if (!Array.isReadonlyArrayNonEmpty(entityIds)) return;
            const highestSortId = sql`(SELECT MAX(${entityTable.tableModel.sortId}) FROM ${entityTable.tableModel})`;
            const placesAfterHighest = sql.join(
              Array.map(entityIds, (entityId, placeIndex) => sql`WHEN ${entityId} THEN ${placeIndex + 1}`),
              sql` `
            );
            const updatedAt = yield* repositoryUtils.formatCurrentTimestamp;
            yield* database
              .update(entityTable.tableModel)
              .set({
                sortId: sql`${highestSortId} + CASE ${entityTable.tableModel.id} ${placesAfterHighest} END`,
                updatedAt
              })
              .where(and(inArray(entityTable.tableModel.id, entityIds), isNull(entityTable.tableModel.deletedAt)));
          },
          Effect.mapError((cause) => IBaseRepositoryErrors.DatabaseWriteError.make({cause}))
        );

        const entityChangeFeed = yield* entityChangeUtils.startEntityChangeFeed(entityTable);
        const notifyChangeFeedAfter = <Success, Failure>(write: Effect.Effect<Success, Failure>) =>
          Effect.tap(write, () => Queue.offer(entityChangeFeed.ownWriteNotifications, undefined));
        const baseRepository: IBaseRepository<Entity, AddRequest> = {
          add: (addRequest) => notifyChangeFeedAfter(addRow(addRequest)),
          entityChanges: entityChangeFeed.entityChanges,
          findById: findRowById,
          findMany: findRows,
          findPage: findRowPage,
          placeAtEnd: (entityIds) => notifyChangeFeedAfter(placeRowsAtEnd(entityIds)),
          softDelete: (entityId) => notifyChangeFeedAfter(softDeleteRow(entityId)),
          update: (entityId, changes) => notifyChangeFeedAfter(updateRow(entityId, changes)),
          upsert: (addRequest) => notifyChangeFeedAfter(upsertRow(addRequest))
        };

        return yield* ownSpans("BaseRepository", Effect.succeed(baseRepository));
      });

      return {makeFor};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("BaseRepository", this.make())).pipe(
    Layer.provide([RepositoryUtils.layer, EntityChangeUtils.layer, DatabaseLayer])
  );
}
