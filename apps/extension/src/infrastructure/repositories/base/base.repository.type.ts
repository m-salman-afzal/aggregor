import type {SQL} from "drizzle-orm";
import type {EffectSQLiteNodeDatabase} from "drizzle-orm/effect-sqlite-node";
import type {SQLiteColumn, SQLiteTable} from "drizzle-orm/sqlite-core";
import type {Schema} from "effect";

export type BaseTableModel = Readonly<Record<"deletedAt" | "id" | "sortId" | "updatedAt", SQLiteColumn>> & SQLiteTable;

export interface EntityTable<Entity> {
  readonly entitySchema: Schema.Decoder<Entity>;
  readonly join?: TableJoin;
  readonly tableModel: BaseTableModel;
}

export interface RepositoryTable<Entity> extends EntityTable<Entity> {
  readonly database: EffectSQLiteNodeDatabase;
}

export type StoredColumns = Readonly<Record<string, unknown>>;

export interface TableJoin {
  readonly joinCondition: SQL;
  readonly joinedColumns: Readonly<Record<string, SQLiteColumn>>;
  readonly joinedTable: SQLiteTable;
}
