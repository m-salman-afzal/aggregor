import {BaseEntity} from "@entities/base/base.entity.ts";
import {DatabaseReadError} from "@entities/base/base.repository.interface.ts";
import {selectRows, watchDataVersionChanges} from "@repositories/base/repository.utils.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {gte, max} from "drizzle-orm";
import {Array, DateTime, Effect, PubSub, Queue, Schema, Stream} from "effect";

import type {EntityChange} from "@entities/base/base.repository.interface.ts";
import type {RepositoryTable} from "@repositories/base/base.repository.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// Rows written at the cursor's own instant are read again by the next check, and skipped unless they changed.
interface ChangeCursor {
  readonly highestSortId: number;
  readonly latestRowsAsJson: ReadonlyMap<EntityIdValueObject, string>;
  readonly latestUpdatedAt: string;
}

interface ChangedRow<Entity> {
  readonly entity: Entity;
  readonly storedRowJson: string;
  readonly updatedAt: string;
}

interface ChangeFeed<Entity> {
  readonly entityChanges: PubSub.PubSub<EntityChange<Entity>>;
  readonly initialChangeCursor: ChangeCursor;
  readonly ownWriteNotifications: Queue.Queue<undefined>;
}

const StoredRowJsonSchema = Schema.fromJsonString(Schema.Unknown);

const LatestWriteRowsSchema = Schema.Tuple([
  Schema.Struct({highestSortId: Schema.NullOr(Schema.Int), latestUpdatedAt: Schema.NullOr(Schema.String)})
]);

// Where change checks start: after every row written before the window started.
const readStartingChangeCursor = Effect.fn("BaseRepository.readStartingChangeCursor")(
  function* <Entity>(repositoryTable: RepositoryTable<Entity>) {
    const latestStampsRows = yield* repositoryTable.database
      .select({
        highestSortId: max(repositoryTable.tableModel.sortId),
        latestUpdatedAt: max(repositoryTable.tableModel.updatedAt)
      })
      .from(repositoryTable.tableModel);
    const [latestWriteStamps] = yield* Schema.decodeUnknownEffect(LatestWriteRowsSchema)(latestStampsRows);
    const changeCursor: ChangeCursor = {
      highestSortId: latestWriteStamps.highestSortId === null ? 0 : latestWriteStamps.highestSortId,
      latestRowsAsJson: new Map(),
      latestUpdatedAt: latestWriteStamps.latestUpdatedAt === null ? "" : latestWriteStamps.latestUpdatedAt
    };

    return changeCursor;
  },
  Effect.mapError((cause) => DatabaseReadError.make({cause}))
);

// Every row written at or after the instant, soft-deleted ones too; a row that no longer decodes is skipped.
const readRowsWrittenSince = Effect.fn("BaseRepository.readRowsWrittenSince")(function* <Entity extends BaseEntity>(
  repositoryTable: RepositoryTable<Entity>,
  writtenSince: string
) {
  const storedRows = yield* selectRows(
    repositoryTable,
    gte(repositoryTable.tableModel.updatedAt, writtenSince),
    repositoryTable.tableModel.updatedAt
  );
  const changedRowResults = yield* Effect.forEach(storedRows, (storedRow) =>
    Effect.result(
      Effect.zipWith(
        BaseEntity.fromRow(repositoryTable.entitySchema, storedRow),
        Schema.encodeUnknownEffect(StoredRowJsonSchema)(storedRow),
        (entity, storedRowJson): ChangedRow<Entity> => ({
          entity,
          storedRowJson,
          updatedAt: DateTime.formatIso(entity.updatedAt)
        })
      )
    )
  );

  return Array.getSuccesses(changedRowResults);
});

const advanceChangeCursor = Effect.fn("BaseRepository.advanceChangeCursor")(function* <Entity extends BaseEntity>(
  changeCursor: ChangeCursor,
  changedRows: readonly ChangedRow<Entity>[]
) {
  const lastWrittenRow = changedRows.at(-1);
  if (lastWrittenRow === undefined) return changeCursor;
  const latestRows = Array.filter(changedRows, (writtenRow) => writtenRow.updatedAt === lastWrittenRow.updatedAt);
  const nextChangeCursor: ChangeCursor = {
    highestSortId: Math.max(
      changeCursor.highestSortId,
      ...Array.map(changedRows, (changedRow) => changedRow.entity.sortId)
    ),
    latestRowsAsJson: new Map(
      Array.map(latestRows, (latestRow) => [latestRow.entity.id, latestRow.storedRowJson] as const)
    ),
    latestUpdatedAt: lastWrittenRow.updatedAt
  };

  return nextChangeCursor;
});

const toEntityChange = Effect.fn("BaseRepository.toEntityChange")(function* <Entity extends BaseEntity>(
  changeCursor: ChangeCursor,
  entity: Entity
) {
  if (entity.deletedAt !== undefined) return {entity, kind: ENTITY_CHANGE_KINDS.REMOVED} satisfies EntityChange<Entity>;

  return {
    entity,
    kind: entity.sortId > changeCursor.highestSortId ? ENTITY_CHANGE_KINDS.PLACED : ENTITY_CHANGE_KINDS.UPDATED
  } satisfies EntityChange<Entity>;
});

// A failed check changes nothing, and the next one reads from the same cursor.
const findEntityChanges = Effect.fn("BaseRepository.findEntityChanges")(
  function* <Entity extends BaseEntity>(repositoryTable: RepositoryTable<Entity>, changeCursor: ChangeCursor) {
    const changedRows = yield* readRowsWrittenSince(repositoryTable, changeCursor.latestUpdatedAt);
    const rowsNotSeenYet = Array.filter(
      changedRows,
      (changedRow) => changeCursor.latestRowsAsJson.get(changedRow.entity.id) !== changedRow.storedRowJson
    );
    const entityChanges = yield* Effect.forEach(rowsNotSeenYet, (rowNotSeenYet) =>
      toEntityChange(changeCursor, rowNotSeenYet.entity)
    );
    const nextChangeCursor = yield* advanceChangeCursor(changeCursor, changedRows);

    return [nextChangeCursor, entityChanges] as const;
  },
  (effect, _repositoryTable, changeCursor) =>
    Effect.catch(effect, (readError) =>
      Effect.as(Effect.logWarning("Could not read the database's changes", readError), [changeCursor, []] as const)
    )
);

// Checks again after another connection's write, which data_version shows, and after each of this window's own.
const publishEntityChanges = Effect.fn("BaseRepository.publishEntityChanges")(
  function* <Entity extends BaseEntity>(repositoryTable: RepositoryTable<Entity>, changeFeed: ChangeFeed<Entity>) {
    const dataVersionChanges = yield* watchDataVersionChanges();
    const changeCheckTriggers = Stream.merge(dataVersionChanges, Stream.fromQueue(changeFeed.ownWriteNotifications));
    const entityChangesFound = Stream.mapAccumEffect(
      changeCheckTriggers,
      () => changeFeed.initialChangeCursor,
      (changeCursor) => findEntityChanges(repositoryTable, changeCursor)
    );

    yield* Stream.runForEach(entityChangesFound, (entityChange) =>
      PubSub.publish(changeFeed.entityChanges, entityChange)
    );
  },
  Effect.ignore({log: "Warn", message: "Could not watch the database for changes"})
);

// Reads where to start before the window's first write, so no write falls between the read and the first check.
export const startEntityChangeFeed = Effect.fn("BaseRepository.startEntityChangeFeed")(function* <
  Entity extends BaseEntity
>(repositoryTable: RepositoryTable<Entity>) {
  const changeFeed: ChangeFeed<Entity> = {
    entityChanges: yield* PubSub.unbounded<EntityChange<Entity>>(),
    initialChangeCursor: yield* readStartingChangeCursor(repositoryTable),
    ownWriteNotifications: yield* Queue.unbounded<undefined>()
  };
  yield* Effect.forkScoped(publishEntityChanges(repositoryTable, changeFeed));

  return {
    entityChanges: Stream.fromPubSub(changeFeed.entityChanges),
    ownWriteNotifications: changeFeed.ownWriteNotifications
  };
});
