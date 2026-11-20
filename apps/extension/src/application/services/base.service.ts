import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer} from "effect";

import type {IBaseRepository, PageRequest} from "@entities/base/base.repository.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export class BaseService extends Context.Service<BaseService>()(
  "aggregor-app/application/services/base.service/BaseService",
  {
    make: Effect.fn("make")(function* () {
      const makeFor = Effect.fn("makeFor")(function* <Entity, AddRequest>(
        repository: IBaseRepository<Entity, AddRequest>
      ) {
        const addEntity = Effect.fn("addEntity")(function* (addRequest: AddRequest) {
          return yield* repository.add(addRequest);
        });

        const findEntityById = Effect.fn("findEntityById")(function* (entityId: EntityIdValueObject) {
          return yield* repository.findById(entityId);
        });

        const findEntities = Effect.fn("findEntities")(function* (filter: Partial<AddRequest>) {
          return yield* repository.findMany(filter);
        });

        const findEntityPage = Effect.fn("findEntityPage")(function* (
          filter: Partial<AddRequest>,
          pageRequest: PageRequest
        ) {
          return yield* repository.findPage(filter, pageRequest);
        });

        const updateEntity = Effect.fn("updateEntity")(function* (
          entityId: EntityIdValueObject,
          changes: Partial<AddRequest>
        ) {
          yield* repository.update(entityId, changes);
        });

        const upsertEntity = Effect.fn("upsertEntity")(function* (addRequest: AddRequest) {
          return yield* repository.upsert(addRequest);
        });

        const removeEntity = Effect.fn("removeEntity")(function* (entityId: EntityIdValueObject) {
          yield* repository.softDelete(entityId);
        });

        const placeEntitiesAtEnd = Effect.fn("placeEntitiesAtEnd")(function* (
          entityIds: readonly EntityIdValueObject[]
        ) {
          yield* repository.placeAtEnd(entityIds);
        });

        return yield* ownSpans(
          "BaseService",
          Effect.succeed({
            addEntity,
            findEntities,
            findEntityById,
            findEntityPage,
            placeEntitiesAtEnd,
            removeEntity,
            updateEntity,
            upsertEntity
          })
        );
      });

      return {makeFor};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("BaseService", this.make()));
}
