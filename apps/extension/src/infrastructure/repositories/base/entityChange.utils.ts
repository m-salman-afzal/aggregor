import {DatabaseLayer} from "@di/database.layer.ts";
import {BaseEntity} from "@entities/base/base.entity.ts";
import {IBaseRepositoryErrors} from "@entities/base/base.repository.interface.ts";
import {RepositoryUtils} from "@repositories/base/repository.utils.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {gte, max} from "drizzle-orm";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {Array, Context, DateTime, Effect, Layer, PubSub, Queue, Schema, Stream} from "effect";

import type {EntityChange} from "@entities/base/base.repository.interface.ts";
import type {EntityTable} from "@repositories/base/base.repository.type.ts";
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

export class EntityChangeUtils extends Context.Service<EntityChangeUtils>()(
  "aggregor-app/infrastructure/repositories/base/entityChange.utils/EntityChangeUtils",
  {
    make: Effect.fn("EntityChangeUtils.make")(function* () {
      const database = yield* makeWithDefaults();
      const repositoryUtils = yield* RepositoryUtils;

      const readStartingChangeCursor = Effect.fn("EntityChangeUtils.readStartingChangeCursor")(
        function* <Entity>(entityTable: EntityTable<Entity>) {
          const latestStampsRows = yield* database
            .select({
              highestSortId: max(entityTable.tableModel.sortId),
              latestUpdatedAt: max(entityTable.tableModel.updatedAt)
            })
            .from(entityTable.tableModel);
          const [latestWriteStamps] = yield* Schema.decodeUnknownEffect(LatestWriteRowsSchema)(latestStampsRows);
          const changeCursor: ChangeCursor = {
            highestSortId: latestWriteStamps.highestSortId === null ? 0 : latestWriteStamps.highestSortId,
            latestRowsAsJson: new Map(),
            latestUpdatedAt: latestWriteStamps.latestUpdatedAt === null ? "" : latestWriteStamps.latestUpdatedAt
          };

          return changeCursor;
        },
        Effect.mapError((cause) => IBaseRepositoryErrors.DatabaseReadError.make({cause}))
      );

      const readRowsWrittenSince = Effect.fn("EntityChangeUtils.readRowsWrittenSince")(function* <
        Entity extends BaseEntity
      >(entityTable: EntityTable<Entity>, writtenSince: string) {
        const storedRows = yield* repositoryUtils.selectRows(
          entityTable,
          gte(entityTable.tableModel.updatedAt, writtenSince),
          entityTable.tableModel.updatedAt
        );
        const changedRowResults = yield* Effect.forEach(storedRows, (storedRow) =>
          Effect.result(
            Effect.zipWith(
              BaseEntity.decodeStoredRow(entityTable.entitySchema, storedRow),
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

      const advanceChangeCursor = Effect.fn("EntityChangeUtils.advanceChangeCursor")(function* <
        Entity extends BaseEntity
      >(changeCursor: ChangeCursor, changedRows: readonly ChangedRow<Entity>[]) {
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

      const makeEntityChange = Effect.fn("EntityChangeUtils.makeEntityChange")(function* <Entity extends BaseEntity>(
        changeCursor: ChangeCursor,
        entity: Entity
      ) {
        if (entity.deletedAt !== undefined)
          return {entity, kind: ENTITY_CHANGE_KINDS.REMOVED} satisfies EntityChange<Entity>;

        return {
          entity,
          kind: entity.sortId > changeCursor.highestSortId ? ENTITY_CHANGE_KINDS.PLACED : ENTITY_CHANGE_KINDS.UPDATED
        } satisfies EntityChange<Entity>;
      });

      const findEntityChanges = Effect.fn("EntityChangeUtils.findEntityChanges")(
        function* <Entity extends BaseEntity>(entityTable: EntityTable<Entity>, changeCursor: ChangeCursor) {
          const changedRows = yield* readRowsWrittenSince(entityTable, changeCursor.latestUpdatedAt);
          const rowsNotSeenYet = Array.filter(
            changedRows,
            (changedRow) => changeCursor.latestRowsAsJson.get(changedRow.entity.id) !== changedRow.storedRowJson
          );
          const entityChanges = yield* Effect.forEach(rowsNotSeenYet, (rowNotSeenYet) =>
            makeEntityChange(changeCursor, rowNotSeenYet.entity)
          );
          const nextChangeCursor = yield* advanceChangeCursor(changeCursor, changedRows);

          return [nextChangeCursor, entityChanges] as const;
        },
        (effect, _entityTable, changeCursor) =>
          Effect.catch(effect, (readError) =>
            Effect.as(Effect.logWarning("Could not read the database's changes", readError), [
              changeCursor,
              []
            ] as const)
          )
      );

      const publishEntityChanges = Effect.fn("EntityChangeUtils.publishEntityChanges")(
        function* <Entity extends BaseEntity>(entityTable: EntityTable<Entity>, changeFeed: ChangeFeed<Entity>) {
          const dataVersionChanges = yield* repositoryUtils.watchDataVersionChanges;
          const changeCheckTriggers = Stream.merge(
            dataVersionChanges,
            Stream.fromQueue(changeFeed.ownWriteNotifications)
          );
          const entityChangesFound = Stream.mapAccumEffect(
            changeCheckTriggers,
            () => changeFeed.initialChangeCursor,
            (changeCursor) => findEntityChanges(entityTable, changeCursor)
          );

          yield* Stream.runForEach(entityChangesFound, (entityChange) =>
            PubSub.publish(changeFeed.entityChanges, entityChange)
          );
        },
        Effect.ignore({log: "Warn", message: "Could not watch the database for changes"})
      );

      // Reads where to start before the window's first write, so no write falls between the read and the first check.
      const startEntityChangeFeed = Effect.fn("EntityChangeUtils.startEntityChangeFeed")(function* <
        Entity extends BaseEntity
      >(entityTable: EntityTable<Entity>) {
        const changeFeed: ChangeFeed<Entity> = {
          entityChanges: yield* PubSub.unbounded<EntityChange<Entity>>(),
          initialChangeCursor: yield* readStartingChangeCursor(entityTable),
          ownWriteNotifications: yield* Queue.unbounded<undefined>()
        };
        yield* Effect.forkScoped(publishEntityChanges(entityTable, changeFeed));

        return {
          entityChanges: Stream.fromPubSub(changeFeed.entityChanges),
          ownWriteNotifications: changeFeed.ownWriteNotifications
        };
      });

      return {startEntityChangeFeed};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([RepositoryUtils.layer, DatabaseLayer])
  );
}
