import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Context, DateTime, Effect, Layer, String} from "effect";
import {SecureRandom} from "effect/crypto";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export class EntityIdDomainService extends Context.Service<EntityIdDomainService>()(
  "aggregor-app/domain/services/entityId.domainService/EntityIdDomainService",
  {
    make: Effect.fn("make")(function* () {
      const secureRandom = yield* SecureRandom.SecureRandom;

      const makeEntityId = Effect.fn("makeEntityId")(function* () {
        const entityUuid = yield* secureRandom.uuidV7();

        return EntityIdValueObjectSchema.make(entityUuid);
      });

      const getEntityIdCreatedAt = Effect.fn("getEntityIdCreatedAt")(function* (entityId: EntityIdValueObject) {
        const createdAtMilliseconds = Number.parseInt(
          `${String.slice(0, 8)(entityId)}${String.slice(9, 13)(entityId)}`,
          16
        );

        return DateTime.makeUnsafe(createdAtMilliseconds);
      });

      return {getEntityIdCreatedAt, makeEntityId: makeEntityId()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("EntityIdDomainService", this.make()));
}
