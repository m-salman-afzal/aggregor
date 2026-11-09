import {Effect} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Context} from "effect";

type RepositoryKey<Identifier, Entity, AddRequest> = Context.Key<Identifier, IBaseRepository<Entity, AddRequest>>;

export const addEntity = Effect.fn("BaseService.addEntity")(function* <Identifier, Entity, AddRequest>(
  repositoryKey: RepositoryKey<Identifier, Entity, AddRequest>,
  addRequest: AddRequest
) {
  const repository = yield* repositoryKey;

  return yield* repository.add(addRequest);
});

export const findEntityById = Effect.fn("BaseService.findEntityById")(function* <Identifier, Entity, AddRequest>(
  repositoryKey: RepositoryKey<Identifier, Entity, AddRequest>,
  entityId: EntityIdValueObject
) {
  const repository = yield* repositoryKey;

  return yield* repository.findById(entityId);
});

export const findEntities = Effect.fn("BaseService.findEntities")(function* <Identifier, Entity, AddRequest>(
  repositoryKey: RepositoryKey<Identifier, Entity, AddRequest>,
  filter: Partial<AddRequest>
) {
  const repository = yield* repositoryKey;

  return yield* repository.findMany(filter);
});

export const updateEntity = Effect.fn("BaseService.updateEntity")(function* <Identifier, Entity, AddRequest>(
  repositoryKey: RepositoryKey<Identifier, Entity, AddRequest>,
  entityId: EntityIdValueObject,
  changes: Partial<AddRequest>
) {
  const repository = yield* repositoryKey;
  yield* repository.update(entityId, changes);
});

export const upsertEntity = Effect.fn("BaseService.upsertEntity")(function* <Identifier, Entity, AddRequest>(
  repositoryKey: RepositoryKey<Identifier, Entity, AddRequest>,
  addRequest: AddRequest
) {
  const repository = yield* repositoryKey;

  return yield* repository.upsert(addRequest);
});

export const removeEntity = Effect.fn("BaseService.removeEntity")(function* <Identifier, Entity, AddRequest>(
  repositoryKey: RepositoryKey<Identifier, Entity, AddRequest>,
  entityId: EntityIdValueObject
) {
  const repository = yield* repositoryKey;
  yield* repository.softDelete(entityId);
});
