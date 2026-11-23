import {Schema} from "effect";

import {EntityIdValueObjectSchema} from "@/valueObjects/entityId.valueObject.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";

import type {Effect, Stream} from "effect";

import type {EntityChangeKindValueObject} from "@/valueObjects/entityChangeKind.valueObject.ts";
import type {EntityIdValueObject} from "@/valueObjects/entityId.valueObject.ts";
import type {PaginationValueObject} from "@/valueObjects/pagination.valueObject.ts";

export interface EntityChange<Entity> {
  readonly entity: Entity;
  readonly kind: EntityChangeKindValueObject;
}

export type PageRequest = Pick<PaginationValueObject, "afterCursor" | "pageSize">;

export interface EntityPage<Entity> {
  readonly entities: readonly Entity[];
  readonly pagination: PaginationValueObject;
}

export class IBaseRepositoryErrors extends TaggedErrors({
  DatabaseReadError: {cause: Schema.Unknown},
  DatabaseWriteError: {cause: Schema.Unknown},
  EntityNotFoundError: {entityId: EntityIdValueObjectSchema}
}) {}

export interface IBaseRepository<Entity, AddRequest> {
  readonly add: (
    addRequest: AddRequest
  ) => Effect.Effect<Entity, IBaseRepositoryErrors["DatabaseReadError" | "DatabaseWriteError"]>;
  // From this window at once, and from aggregor-pty or another window within a poll.
  readonly entityChanges: Stream.Stream<EntityChange<Entity>>;
  readonly findById: (
    entityId: EntityIdValueObject
  ) => Effect.Effect<Entity, IBaseRepositoryErrors["DatabaseReadError" | "EntityNotFoundError"]>;
  readonly findMany: (
    filter: Partial<AddRequest>
  ) => Effect.Effect<readonly Entity[], IBaseRepositoryErrors["DatabaseReadError"]>;
  // Newest first, the reverse of findMany's order: the highest sortId leads.
  readonly findPage: (
    filter: Partial<AddRequest>,
    pageRequest: PageRequest
  ) => Effect.Effect<EntityPage<Entity>, IBaseRepositoryErrors["DatabaseReadError"]>;
  readonly placeAtEnd: (
    entityIds: readonly EntityIdValueObject[]
  ) => Effect.Effect<void, IBaseRepositoryErrors["DatabaseWriteError"]>;
  readonly softDelete: (
    entityId: EntityIdValueObject
  ) => Effect.Effect<void, IBaseRepositoryErrors["DatabaseWriteError"]>;
  readonly update: (
    entityId: EntityIdValueObject,
    changes: Partial<AddRequest>
  ) => Effect.Effect<void, IBaseRepositoryErrors["DatabaseWriteError" | "EntityNotFoundError"]>;
  readonly upsert: (
    addRequest: AddRequest
  ) => Effect.Effect<Entity, IBaseRepositoryErrors["DatabaseReadError" | "DatabaseWriteError"]>;
}
