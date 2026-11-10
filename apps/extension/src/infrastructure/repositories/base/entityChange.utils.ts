import {BaseEntity} from "@entities/base/base.entity.ts";
import {DatabaseReadError} from "@entities/base/base.repository.interface.ts";
import {selectRows, watchDataVersionChanges} from "@repositories/base/repository.utils.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {gte, max} from "drizzle-orm";
import {Array, DateTime, Effect, PubSub, Queue, Schema, Stream} from "effect";

import type {EntityChange} from "@entities/base/base.repository.interface.ts";
import type {RepositoryTable} from "@repositories/base/base.repository.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// How a repository hears about writes to its table, its own and other connections', without keeping a copy of the
// rows: it reads the rows written since its last check.

// Where the last check of the table stopped: the latest updatedAt it read, each row written at that same instant (the
// next check reads them again, and skips them unless they changed), and the highest sortId, above which a row was
// placed: new, or moved after every other row.
interface ChangeCursor {
  readonly highestSortId: number;
  readonly latestRowsAsJson: ReadonlyMap<EntityIdValueObject, string>;
  readonly latestUpdatedAt: string;
}

// A row as the change check read it: the entity, its stored form, and its updatedAt as stored.
interface ChangedRow<Entity> {
  readonly entity: Entity;
  readonly storedRowJson: string;
  readonly updatedAt: string;
}

// What the change check runs on: where it starts, the notification each own write sends, and where it publishes.
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
  function* <Entity>({database, tableModel}: RepositoryTable<Entity>) {
    const latestStampsRows = yield* database
      .select({highestSortId: max(tableModel.sortId), latestUpdatedAt: max(tableModel.updatedAt)})
      .from(tableModel);
    const [{highestSortId, latestUpdatedAt}] =
      yield* Schema.decodeUnknownEffect(LatestWriteRowsSchema)(latestStampsRows);
    const changeCursor: ChangeCursor = {
      highestSortId: highestSortId === null ? 0 : highestSortId,
      latestRowsAsJson: new Map(),
      latestUpdatedAt: latestUpdatedAt === null ? "" : latestUpdatedAt
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
  const {entitySchema, tableModel} = repositoryTable;
  const storedRows = yield* selectRows(repositoryTable, gte(tableModel.updatedAt, writtenSince), tableModel.updatedAt);
  const changedRowResults = yield* Effect.forEach(storedRows, (storedRow) =>
    Effect.result(
      Effect.zipWith(
        BaseEntity.fromRow(entitySchema, storedRow),
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
    highestSortId: Math.max(changeCursor.highestSortId, ...Array.map(changedRows, ({entity}) => entity.sortId)),
    latestRowsAsJson: new Map(Array.map(latestRows, ({entity, storedRowJson}) => [entity.id, storedRowJson] as const)),
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
      ({entity, storedRowJson}) => changeCursor.latestRowsAsJson.get(entity.id) !== storedRowJson
    );
    const entityChanges = yield* Effect.forEach(rowsNotSeenYet, ({entity}) => toEntityChange(changeCursor, entity));
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
