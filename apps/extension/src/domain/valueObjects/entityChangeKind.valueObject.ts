import {Schema} from "effect";

export const EntityChangeKindValueObjectSchema = Schema.Enum({
  PLACED: "placed",
  REMOVED: "removed",
  UPDATED: "updated"
});

export const ENTITY_CHANGE_KINDS = EntityChangeKindValueObjectSchema.enums;

export type EntityChangeKindValueObject = typeof EntityChangeKindValueObjectSchema.Type;
