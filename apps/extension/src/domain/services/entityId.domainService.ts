import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {DateTime, Effect, String} from "effect";
import {SecureRandom} from "effect/crypto";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export const makeEntityId = Effect.fn("EntityIdDomainService.makeEntityId")(function* () {
  const {uuidV7} = yield* SecureRandom.SecureRandom;
  const entityUuid = yield* uuidV7();

  return EntityIdValueObjectSchema.make(entityUuid);
});

export const getEntityIdCreatedAt = Effect.fn("EntityIdDomainService.getEntityIdCreatedAt")(function* (
  entityId: EntityIdValueObject
) {
  const createdAtMilliseconds = Number.parseInt(`${String.slice(0, 8)(entityId)}${String.slice(9, 13)(entityId)}`, 16);

  return DateTime.makeUnsafe(createdAtMilliseconds);
});
