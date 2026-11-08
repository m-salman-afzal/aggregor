import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Effect, Record, Schema} from "effect";

const StoredTimestampsSchema = Schema.Struct({
  deletedAt: Schema.optional(Schema.DateTimeUtcFromString),
  updatedAt: Schema.DateTimeUtcFromString
});

export class BaseEntity extends Schema.Class<BaseEntity, {readonly brand: unique symbol}>("BaseEntity")({
  deletedAt: Schema.optional(Schema.DateTimeUtc),
  id: EntityIdValueObjectSchema,
  sortId: Schema.Int,
  updatedAt: Schema.DateTimeUtc
}) {
  public static fromRow<Entity>(
    entitySchema: Schema.Decoder<Entity>,
    storedRow: Readonly<Record<string, unknown>>
  ): Effect.Effect<Entity, Schema.SchemaError> {
    const presentColumns = Record.filter(storedRow, (storedValue) => storedValue !== null);

    return Effect.flatMap(Schema.decodeUnknownEffect(StoredTimestampsSchema)(presentColumns), (timestamps) =>
      Schema.decodeEffect(entitySchema)({...presentColumns, ...timestamps})
    );
  }
}
