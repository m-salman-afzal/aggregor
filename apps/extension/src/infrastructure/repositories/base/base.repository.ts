import {makeEntityId} from "@domainServices/entityId.domainService.ts";
import {BaseEntity} from "@entities/base/base.entity.ts";
import {DatabaseReadError, DatabaseWriteError, EntityNotFoundError} from "@entities/base/base.repository.interface.ts";
import {startEntityChangeFeed} from "@repositories/base/entityChange.utils.ts";
import {
  encodeStoredColumns,
  findUniqueColumns,
  formatCurrentTimestamp,
  makeFilterClauses,
  selectRows
} from "@repositories/base/repository.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {and, eq, inArray, isNull, sql} from "drizzle-orm";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {Array, Context, Effect, Queue, Record, Schema} from "effect";
import {SecureRandom} from "effect/crypto";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {EntityTable, RepositoryTable, StoredColumns} from "@repositories/base/base.repository.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {SQLiteColumn} from "drizzle-orm/sqlite-core";

const findRows = Effect.fn("BaseRepository.findRows")(
  function* <Entity>(repositoryTable: RepositoryTable<Entity>, filter: StoredColumns) {
    const filterClauses = yield* makeFilterClauses(repositoryTable.tableModel, filter);
    const storedRows = yield* selectRows(
      repositoryTable,
      and(isNull(repositoryTable.tableModel.deletedAt), ...filterClauses),
      repositoryTable.tableModel.sortId
    );

    return yield* Effect.forEach(storedRows, (storedRow) =>
      BaseEntity.fromRow(repositoryTable.entitySchema, storedRow)
    );
  },
  Effect.mapError((cause) => DatabaseReadError.make({cause}))
);

const findRowById = Effect.fn("BaseRepository.findRowById")(function* <Entity>(
  repositoryTable: RepositoryTable<Entity>,
  entityId: EntityIdValueObject
) {
  const [foundEntity] = yield* findRows(repositoryTable, {id: entityId});
  if (foundEntity === undefined) return yield* EntityNotFoundError.make({entityId});

  return foundEntity;
});

// AUTOINCREMENT needs an integer primary key, so sortId is MAX + 1, inside the writing statement.
const writeRowAtEnd = Effect.fn("BaseRepository.writeRowAtEnd")(function* <Entity>(
  repositoryTable: RepositoryTable<Entity>,
  addRequest: StoredColumns,
  conflictColumns: readonly SQLiteColumn[]
) {
  const nextSortId = sql`(SELECT COALESCE(MAX(${repositoryTable.tableModel.sortId}), 0) + 1 FROM ${repositoryTable.tableModel})`;
  const updatedAt = yield* formatCurrentTimestamp();
  const storedColumns = {
    ...(yield* encodeStoredColumns(addRequest)),
    id: yield* makeEntityId(),
    sortId: nextSortId,
    updatedAt
  };
  const conflictColumnNames = Array.map(conflictColumns, (conflictColumn) => conflictColumn.name);
  const changedColumns = {
    ...Record.filter(storedColumns, (_columnValue, column) => column !== "id" && !conflictColumnNames.includes(column)),
    deletedAt: null
  };
  const [writtenRow] = yield* repositoryTable.database
    .insert(repositoryTable.tableModel)
    .values(storedColumns)
    .onConflictDoUpdate({set: changedColumns, target: [...conflictColumns]})
    .returning({id: repositoryTable.tableModel.id});
  if (writtenRow === undefined) return yield* Effect.die("A write returned no row");

  return yield* Schema.decodeUnknownEffect(EntityIdValueObjectSchema)(writtenRow.id);
});

const writeAndReadRow = Effect.fn("BaseRepository.writeAndReadRow")(
  function* <Entity>(
    repositoryTable: RepositoryTable<Entity>,
    addRequest: StoredColumns,
    conflictColumns: readonly SQLiteColumn[]
  ) {
    const entityId = yield* Effect.mapError(writeRowAtEnd(repositoryTable, addRequest, conflictColumns), (cause) =>
      DatabaseWriteError.make({cause})
    );

    return yield* findRowById(repositoryTable, entityId);
  },
  Effect.catchTag("EntityNotFoundError", (entityNotFound) =>
    Effect.fail(DatabaseReadError.make({cause: entityNotFound}))
  )
);

// A conflict on the new id never happens, so this always inserts; a unique-column clash still fails.
const addRow = Effect.fn("BaseRepository.addRow")(function* <Entity>(
  repositoryTable: RepositoryTable<Entity>,
  addRequest: StoredColumns
) {
  return yield* writeAndReadRow(repositoryTable, addRequest, [repositoryTable.tableModel.id]);
});

const upsertRow = Effect.fn("BaseRepository.upsertRow")(function* <Entity>(
  repositoryTable: RepositoryTable<Entity>,
  addRequest: StoredColumns
) {
  const uniqueColumns = yield* findUniqueColumns(repositoryTable.tableModel);

  return yield* writeAndReadRow(repositoryTable, addRequest, uniqueColumns);
});

const updateRow = Effect.fn("BaseRepository.updateRow")(function* <Entity>(
  repositoryTable: RepositoryTable<Entity>,
  entityId: EntityIdValueObject,
  changes: StoredColumns
) {
  const changedColumns = {...(yield* encodeStoredColumns(changes)), updatedAt: yield* formatCurrentTimestamp()};
  const updatedRows = Effect.mapError(
    repositoryTable.database
      .update(repositoryTable.tableModel)
      .set(changedColumns)
      .where(and(eq(repositoryTable.tableModel.id, entityId), isNull(repositoryTable.tableModel.deletedAt)))
      .returning({id: repositoryTable.tableModel.id}),
    (cause) => DatabaseWriteError.make({cause})
  );
  yield* Effect.filterOrFail(
    updatedRows,
    (updatedRowIds) => updatedRowIds.length > 0,
    () => EntityNotFoundError.make({entityId})
  );
});

const softDeleteRow = Effect.fn("BaseRepository.softDeleteRow")(
  function* <Entity>(repositoryTable: RepositoryTable<Entity>, entityId: EntityIdValueObject) {
    const deletedAt = yield* formatCurrentTimestamp();
    yield* repositoryTable.database
      .update(repositoryTable.tableModel)
      .set({deletedAt, updatedAt: deletedAt})
      .where(and(eq(repositoryTable.tableModel.id, entityId), isNull(repositoryTable.tableModel.deletedAt)));
  },
  Effect.mapError((cause) => DatabaseWriteError.make({cause}))
);

// One statement, which reads the highest sortId once, so the rows take the sortIds after it in the order given; the
// change feed then reads them as placed.
const placeRowsAtEnd = Effect.fn("BaseRepository.placeRowsAtEnd")(
  function* <Entity>(repositoryTable: RepositoryTable<Entity>, entityIds: readonly EntityIdValueObject[]) {
    if (!Array.isReadonlyArrayNonEmpty(entityIds)) return;
    const highestSortId = sql`(SELECT MAX(${repositoryTable.tableModel.sortId}) FROM ${repositoryTable.tableModel})`;
    const placesAfterHighest = sql.join(
      Array.map(entityIds, (entityId, placeIndex) => sql`WHEN ${entityId} THEN ${placeIndex + 1}`),
      sql` `
    );
    const updatedAt = yield* formatCurrentTimestamp();
    yield* repositoryTable.database
      .update(repositoryTable.tableModel)
      .set({sortId: sql`${highestSortId} + CASE ${repositoryTable.tableModel.id} ${placesAfterHighest} END`, updatedAt})
      .where(and(inArray(repositoryTable.tableModel.id, entityIds), isNull(repositoryTable.tableModel.deletedAt)));
  },
  Effect.mapError((cause) => DatabaseWriteError.make({cause}))
);

// Every write notifies the change feed, so this window's own writes show at once.
export const makeBaseRepository = Effect.fn("BaseRepository.make")(function* <
  Entity extends BaseEntity,
  AddRequest extends StoredColumns
>(entityTable: EntityTable<Entity>) {
  const repositoryTable: RepositoryTable<Entity> = {...entityTable, database: yield* makeWithDefaults()};
  const secureRandom = yield* SecureRandom.SecureRandom;
  const randomContext = Context.make(SecureRandom.SecureRandom, secureRandom);
  const entityChangeFeed = yield* startEntityChangeFeed(repositoryTable);
  const notifyChangeFeedAfter = <Success, Failure>(write: Effect.Effect<Success, Failure>) =>
    Effect.tap(write, () => Queue.offer(entityChangeFeed.ownWriteNotifications, undefined));
  const baseRepository: IBaseRepository<Entity, AddRequest> = {
    add: (addRequest) => notifyChangeFeedAfter(Effect.provide(addRow(repositoryTable, addRequest), randomContext)),
    entityChanges: entityChangeFeed.entityChanges,
    findById: (entityId) => findRowById(repositoryTable, entityId),
    findMany: (filter) => findRows(repositoryTable, filter),
    placeAtEnd: (entityIds) => notifyChangeFeedAfter(placeRowsAtEnd(repositoryTable, entityIds)),
    softDelete: (entityId) => notifyChangeFeedAfter(softDeleteRow(repositoryTable, entityId)),
    update: (entityId, changes) => notifyChangeFeedAfter(updateRow(repositoryTable, entityId, changes)),
    upsert: (addRequest) => notifyChangeFeedAfter(Effect.provide(upsertRow(repositoryTable, addRequest), randomContext))
  };

  return baseRepository;
});
