import {Schema} from "effect";

export const EntityIdValueObjectSchema = Schema.String.check(Schema.isUUID(7)).pipe(Schema.brand("EntityId"));

export type EntityIdValueObject = typeof EntityIdValueObjectSchema.Type;

export const decodeEntityId = Schema.decodeUnknownResult(EntityIdValueObjectSchema);
