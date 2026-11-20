import {DatabaseLayer} from "@di/database.layer.ts";
import {DATABASE_POLL_INTERVAL} from "@pkg/constants/src/database.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {count, desc, eq, getColumns, isNull} from "drizzle-orm";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {getTableConfig} from "drizzle-orm/sqlite-core";
import {Array, Context, DateTime, Effect, Layer, Predicate, Record, Schedule, Schema, Stream} from "effect";
import {SqlClient} from "effect/sql/SqlClient";

import type {BaseTableModel, EntityTable, StoredColumns} from "@repositories/base/base.repository.type.ts";
import type {SQL} from "drizzle-orm";
import type {SQLiteColumn} from "drizzle-orm/sqlite-core";

const DataVersionRowsSchema = Schema.Tuple([Schema.Struct({dataVersion: Schema.Int})]);

const StoredJsonSchema = Schema.fromJsonString(Schema.Unknown);

export class RepositoryUtils extends Context.Service<RepositoryUtils>()(
  "aggregor-app/infrastructure/repositories/base/repository.utils/RepositoryUtils",
  {
    make: Effect.fn("make")(function* () {
      const database = yield* makeWithDefaults();
      const sql = yield* SqlClient;

      const formatCurrentTimestamp = Effect.fn("formatCurrentTimestamp")(function* () {
        const now = yield* DateTime.now;

        return DateTime.formatIso(now);
      });

      // A missing value is stored as NULL, and a DateTime as ISO 8601 text, as aggregor-pty writes its timestamps.
      const encodeStoredColumn = Effect.fn("encodeStoredColumn")(function* (columnValue: unknown) {
        if (columnValue === undefined) return null;
        if (DateTime.isDateTime(columnValue)) return DateTime.formatIso(columnValue);
        if (!Predicate.isObject(columnValue)) return columnValue;

        return yield* Schema.encodeUnknownEffect(StoredJsonSchema)(columnValue);
      });

      // An object column, such as a project's settings, is stored as its JSON text.
      const encodeStoredColumns = Effect.fn("encodeStoredColumns")(function* (columns: StoredColumns) {
        const encodedEntries = yield* Effect.forEach(Record.toEntries(columns), ([columnName, columnValue]) =>
          Effect.map(encodeStoredColumn(columnValue), (encodedValue) => [columnName, encodedValue] as const)
        );

        return Record.fromEntries(encodedEntries);
      });

      const findUniqueColumns = Effect.fn("findUniqueColumns")(function* (tableModel: BaseTableModel) {
        const tableConfig = getTableConfig(tableModel);
        const uniqueColumns = [
          ...Array.filter(tableConfig.columns, (column) => column.isUnique),
          ...Array.flatMap(tableConfig.uniqueConstraints, (uniqueConstraint) => uniqueConstraint.columns)
        ];

        return Array.isReadonlyArrayNonEmpty(uniqueColumns) ? uniqueColumns : [tableModel.id];
      });

      // Through each column, so a value is stored the way the column stores it (a boolean as 0 or 1).
      const makeFilterClauses = Effect.fn("makeFilterClauses")(function* (
        tableModel: BaseTableModel,
        filter: StoredColumns
      ) {
        const tableColumns: Readonly<Record<string, SQLiteColumn | undefined>> = getColumns(tableModel);

        return yield* Effect.forEach(Record.toEntries(filter), ([columnName, columnValue]) => {
          const column = tableColumns[columnName];
          if (column === undefined) return Effect.die(`The table has no ${columnName} column`);

          return Effect.succeed(
            columnValue === undefined || columnValue === null ? isNull(column) : eq(column, columnValue)
          );
        });
      });

      const readDataVersion = Effect.fn("readDataVersion")(function* () {
        const dataVersionRows = yield* sql`SELECT data_version AS dataVersion FROM pragma_data_version`;
        const [dataVersionRow] = yield* Schema.decodeUnknownEffect(DataVersionRowsSchema)(dataVersionRows);

        return dataVersionRow.dataVersion;
      });

      // data_version changes with each commit from another connection, never this one's own; the poll runs untraced.
      const watchDataVersionChanges = Effect.fn("watchDataVersionChanges")(function* () {
        const dataVersions = Stream.fromEffectSchedule(
          Effect.withTracerEnabled(readDataVersion(), false),
          Schedule.spaced(DATABASE_POLL_INTERVAL)
        );

        return Stream.drop(Stream.changes(dataVersions), 1);
      });

      // Returns the query unrun, for its caller to order and limit.
      const buildJoinedSelect = Effect.fn("buildJoinedSelect")(function* <Entity>(entityTable: EntityTable<Entity>) {
        const joinedColumns = entityTable.join === undefined ? {} : entityTable.join.joinedColumns;
        const selectedRows = database
          .select({...getColumns(entityTable.tableModel), ...joinedColumns})
          .from(entityTable.tableModel)
          .$dynamic();
        const joinedRows =
          entityTable.join === undefined
            ? selectedRows
            : selectedRows.innerJoin(entityTable.join.joinedTable, entityTable.join.joinCondition);

        return {joinedRows};
      });

      const selectRows = Effect.fn("selectRows")(function* <Entity>(
        entityTable: EntityTable<Entity>,
        rowCondition: SQL | undefined,
        orderColumn: SQLiteColumn
      ) {
        const joinedSelect = yield* buildJoinedSelect(entityTable);

        return yield* joinedSelect.joinedRows.where(rowCondition).orderBy(orderColumn);
      });

      // Newest first: the highest sortId leads.
      const selectRowPage = Effect.fn("selectRowPage")(function* <Entity>(
        entityTable: EntityTable<Entity>,
        rowCondition: SQL | undefined,
        pageSize: number
      ) {
        const joinedSelect = yield* buildJoinedSelect(entityTable);

        return yield* joinedSelect.joinedRows
          .where(rowCondition)
          .orderBy(desc(entityTable.tableModel.sortId))
          .limit(pageSize);
      });

      const countRows = Effect.fn("countRows")(function* <Entity>(
        entityTable: EntityTable<Entity>,
        rowCondition: SQL | undefined
      ) {
        const [countRow] = yield* database.select({rowCount: count()}).from(entityTable.tableModel).where(rowCondition);

        return countRow === undefined ? 0 : countRow.rowCount;
      });

      return {
        countRows,
        encodeStoredColumns,
        findUniqueColumns,
        formatCurrentTimestamp: formatCurrentTimestamp(),
        makeFilterClauses,
        selectRowPage,
        selectRows,
        watchDataVersionChanges: watchDataVersionChanges()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("RepositoryUtils", this.make())).pipe(
    Layer.provide(DatabaseLayer)
  );
}
