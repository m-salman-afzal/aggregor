import {Context, Effect, Layer} from "effect";

import type {IBaseRepository, PageRequest} from "@entities/base/base.repository.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export class BaseService extends Context.Service<BaseService>()(
  "aggregor-app/application/services/base.service/BaseService",
  {
    make: Effect.fn("BaseService.make")(function* () {
      const makeForRepository = Effect.fn("BaseService.makeForRepository")(function* <Entity, AddRequest>(
        repository: IBaseRepository<Entity, AddRequest>
      ) {
        const addEntity = Effect.fn("BaseService.addEntity")(function* (addRequest: AddRequest) {
          return yield* repository.add(addRequest);
        });

        const findEntityById = Effect.fn("BaseService.findEntityById")(function* (entityId: EntityIdValueObject) {
          return yield* repository.findById(entityId);
        });

        const findEntities = Effect.fn("BaseService.findEntities")(function* (filter: Partial<AddRequest>) {
          return yield* repository.findMany(filter);
        });

        const findEntityPage = Effect.fn("BaseService.findEntityPage")(function* (
          filter: Partial<AddRequest>,
          pageRequest: PageRequest
        ) {
          return yield* repository.findPage(filter, pageRequest);
        });

        const updateEntity = Effect.fn("BaseService.updateEntity")(function* (
          entityId: EntityIdValueObject,
          changes: Partial<AddRequest>
        ) {
          yield* repository.update(entityId, changes);
        });

        const upsertEntity = Effect.fn("BaseService.upsertEntity")(function* (addRequest: AddRequest) {
          return yield* repository.upsert(addRequest);
        });

        const removeEntity = Effect.fn("BaseService.removeEntity")(function* (entityId: EntityIdValueObject) {
          yield* repository.softDelete(entityId);
        });

        const placeEntitiesAtEnd = Effect.fn("BaseService.placeEntitiesAtEnd")(function* (
          entityIds: readonly EntityIdValueObject[]
        ) {
          yield* repository.placeAtEnd(entityIds);
        });

        return {
          addEntity,
          findEntities,
          findEntityById,
          findEntityPage,
          placeEntitiesAtEnd,
          removeEntity,
          updateEntity,
          upsertEntity
        };
      });

      return {makeForRepository};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
