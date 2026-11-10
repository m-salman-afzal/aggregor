import {Schema} from "effect";

// What a write did to a row, as a repository's change feed reads it: placed it at the end of the table's order (a new
// row, or one moved), changed it where it stands, or soft-deleted it.
export const EntityChangeKindValueObjectSchema = Schema.Enum({
  PLACED: "placed",
  REMOVED: "removed",
  UPDATED: "updated"
});

export const ENTITY_CHANGE_KINDS = EntityChangeKindValueObjectSchema.enums;

export type EntityChangeKindValueObject = typeof EntityChangeKindValueObjectSchema.Type;
