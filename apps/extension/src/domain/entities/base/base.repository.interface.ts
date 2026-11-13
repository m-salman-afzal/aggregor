import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Schema} from "effect";

import type {EntityChangeKindValueObject} from "@valueObjects/entityChangeKind.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Effect, Stream} from "effect";

export interface EntityChange<Entity> {
  readonly entity: Entity;
  readonly kind: EntityChangeKindValueObject;
}

export class DatabaseReadError extends Schema.TaggedError<DatabaseReadError, {readonly brand: unique symbol}>()(
  "DatabaseReadError",
  {cause: Schema.Unknown}
) {}
export class DatabaseWriteError extends Schema.TaggedError<DatabaseWriteError, {readonly brand: unique symbol}>()(
  "DatabaseWriteError",
  {cause: Schema.Unknown}
) {}
export class EntityNotFoundError extends Schema.TaggedError<EntityNotFoundError, {readonly brand: unique symbol}>()(
  "EntityNotFoundError",
  {entityId: EntityIdValueObjectSchema}
) {}

export interface IBaseRepository<Entity, AddRequest> {
  readonly add: (addRequest: AddRequest) => Effect.Effect<Entity, DatabaseReadError | DatabaseWriteError>;
  // From this window at once, and from aggregor-pty or another window within a poll.
  readonly entityChanges: Stream.Stream<EntityChange<Entity>>;
  readonly findById: (entityId: EntityIdValueObject) => Effect.Effect<Entity, DatabaseReadError | EntityNotFoundError>;
  readonly findMany: (filter: Partial<AddRequest>) => Effect.Effect<readonly Entity[], DatabaseReadError>;
  readonly placeAtEnd: (entityIds: readonly EntityIdValueObject[]) => Effect.Effect<void, DatabaseWriteError>;
  readonly softDelete: (entityId: EntityIdValueObject) => Effect.Effect<void, DatabaseWriteError>;
  readonly update: (
    entityId: EntityIdValueObject,
    changes: Partial<AddRequest>
  ) => Effect.Effect<void, DatabaseWriteError | EntityNotFoundError>;
  readonly upsert: (addRequest: AddRequest) => Effect.Effect<Entity, DatabaseReadError | DatabaseWriteError>;
}
