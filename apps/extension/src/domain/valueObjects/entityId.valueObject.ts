import {Schema} from "effect";

// A session's id is also the id its agent gets.
export const EntityIdValueObjectSchema = Schema.String.check(Schema.isUUID(7)).pipe(Schema.brand("EntityId"));

export type EntityIdValueObject = typeof EntityIdValueObjectSchema.Type;

export const decodeEntityId = Schema.decodeUnknownResult(EntityIdValueObjectSchema);
