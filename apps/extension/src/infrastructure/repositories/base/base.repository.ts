import {makeEntityId} from "@domainServices/entityId.domainService.ts";
import {BaseEntity} from "@entities/base/base.entity.ts";
import {DatabaseReadError, DatabaseWriteError, EntityNotFoundError} from "@entities/base/base.repository.interface.ts";
import {
  findUniqueColumns,
  formatNow,
  makeFilterClauses,
  replaceUndefinedWithNull
} from "@repositories/base/repository.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {and, eq, getColumns, isNull, sql} from "drizzle-orm";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {Array, Context, Effect, Record, Schema} from "effect";
import {SecureRandom} from "effect/crypto";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {EntityTable, RepositoryTable, StoredColumns} from "@repositories/base/base.repository.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {SQLiteColumn} from "drizzle-orm/sqlite-core";

const findRows = Effect.fn("BaseRepository.findRows")(
  function* <Entity>({database, entitySchema, join, tableModel}: RepositoryTable<Entity>, filter: StoredColumns) {
    const filterClauses = yield* makeFilterClauses(tableModel, filter);
    const joinedColumns = join === undefined ? {} : join.joinedColumns;
    const selectedRows = database
      .select({...getColumns(tableModel), ...joinedColumns})
      .from(tableModel)
      .$dynamic();
    const joinedRows = join === undefined ? selectedRows : selectedRows.innerJoin(join.joinedTable, join.joinCondition);
    const storedRows = yield* joinedRows
      .where(and(isNull(tableModel.deletedAt), ...filterClauses))
      .orderBy(tableModel.sortId);

    return yield* Effect.forEach(storedRows, (storedRow) => BaseEntity.fromRow(entitySchema, storedRow));
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
  {database, tableModel}: RepositoryTable<Entity>,
  addRequest: StoredColumns,
  conflictColumns: readonly SQLiteColumn[]
) {
  const nextSortId = sql`(SELECT COALESCE(MAX(${tableModel.sortId}), 0) + 1 FROM ${tableModel})`;
  const updatedAt = yield* formatNow();
  const storedColumns = {
    ...(yield* replaceUndefinedWithNull(addRequest)),
    id: yield* makeEntityId(),
    sortId: nextSortId,
    updatedAt
  };
  const conflictColumnNames = Array.map(conflictColumns, (conflictColumn) => conflictColumn.name);
  const changedColumns = {
    ...Record.filter(storedColumns, (_columnValue, column) => column !== "id" && !conflictColumnNames.includes(column)),
    deletedAt: null
  };
  const [writtenRow] = yield* database
    .insert(tableModel)
    .values(storedColumns)
    .onConflictDoUpdate({set: changedColumns, target: [...conflictColumns]})
    .returning({id: tableModel.id});
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
  {database, tableModel}: RepositoryTable<Entity>,
  entityId: EntityIdValueObject,
  changes: StoredColumns
) {
  const changedColumns = {...(yield* replaceUndefinedWithNull(changes)), updatedAt: yield* formatNow()};
  const updatedRows = Effect.mapError(
    database
      .update(tableModel)
      .set(changedColumns)
      .where(and(eq(tableModel.id, entityId), isNull(tableModel.deletedAt)))
      .returning({id: tableModel.id}),
    (cause) => DatabaseWriteError.make({cause})
  );
  yield* Effect.filterOrFail(
    updatedRows,
    (updatedRowIds) => updatedRowIds.length > 0,
    () => EntityNotFoundError.make({entityId})
  );
});

const softDeleteRow = Effect.fn("BaseRepository.softDeleteRow")(
  function* <Entity>({database, tableModel}: RepositoryTable<Entity>, entityId: EntityIdValueObject) {
    const deletedAt = yield* formatNow();
    yield* database
      .update(tableModel)
      .set({deletedAt, updatedAt: deletedAt})
      .where(and(eq(tableModel.id, entityId), isNull(tableModel.deletedAt)));
  },
  Effect.mapError((cause) => DatabaseWriteError.make({cause}))
);

export const makeBaseRepository = Effect.fn("BaseRepository.make")(function* <Entity, AddRequest extends StoredColumns>(
  entityTable: EntityTable<Entity>
) {
  const repositoryTable: RepositoryTable<Entity> = {...entityTable, database: yield* makeWithDefaults()};
  const secureRandom = yield* SecureRandom.SecureRandom;
  const randomContext = Context.make(SecureRandom.SecureRandom, secureRandom);
  const baseRepository: IBaseRepository<Entity, AddRequest> = {
    add: (addRequest) => Effect.provide(addRow(repositoryTable, addRequest), randomContext),
    findById: (entityId) => findRowById(repositoryTable, entityId),
    findMany: (filter) => findRows(repositoryTable, filter),
    softDelete: (entityId) => softDeleteRow(repositoryTable, entityId),
    update: (entityId, changes) => updateRow(repositoryTable, entityId, changes),
    upsert: (addRequest) => Effect.provide(upsertRow(repositoryTable, addRequest), randomContext)
  };

  return baseRepository;
});
