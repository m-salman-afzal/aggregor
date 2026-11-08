import {DATABASE_POLL_INTERVAL} from "@pkg/constants/src/extension.constant.ts";
import {eq, getColumns, isNull} from "drizzle-orm";
import {getTableConfig} from "drizzle-orm/sqlite-core";
import {Array, DateTime, Effect, Record, Schedule, Schema, Stream} from "effect";
import {SqlClient} from "effect/sql/SqlClient";

import type {BaseTableModel, StoredColumns} from "@repositories/base/base.repository.type.ts";
import type {SQLiteColumn} from "drizzle-orm/sqlite-core";

const DataVersionRowsSchema = Schema.Tuple([Schema.Struct({dataVersion: Schema.Int})]);

export const formatNow = Effect.fn("BaseRepository.formatNow")(function* () {
  const now = yield* DateTime.now;

  return DateTime.formatIso(now);
});

export const replaceUndefinedWithNull = Effect.fn("BaseRepository.replaceUndefinedWithNull")(function* (
  columns: StoredColumns
) {
  return Record.map(columns, (columnValue) => (columnValue === undefined ? null : columnValue));
});

export const findUniqueColumns = Effect.fn("BaseRepository.findUniqueColumns")(function* (tableModel: BaseTableModel) {
  const {columns, uniqueConstraints} = getTableConfig(tableModel);
  const uniqueColumns = [
    ...Array.filter(columns, (column) => column.isUnique),
    ...Array.flatMap(uniqueConstraints, (uniqueConstraint) => uniqueConstraint.columns)
  ];

  return Array.isReadonlyArrayNonEmpty(uniqueColumns) ? uniqueColumns : [tableModel.id];
});

// Through each column, so a value is stored the way the column stores it (a boolean as 0 or 1).
export const makeFilterClauses = Effect.fn("BaseRepository.makeFilterClauses")(function* (
  tableModel: BaseTableModel,
  filter: StoredColumns
) {
  const tableColumns: Readonly<Record<string, SQLiteColumn | undefined>> = getColumns(tableModel);

  return yield* Effect.forEach(Record.toEntries(filter), ([columnName, columnValue]) => {
    const column = tableColumns[columnName];
    if (column === undefined) return Effect.die(`The table has no ${columnName} column`);

    return Effect.succeed(columnValue === undefined || columnValue === null ? isNull(column) : eq(column, columnValue));
  });
});

const readDataVersion = Effect.fn("BaseRepository.readDataVersion")(function* () {
  const sql = yield* SqlClient;
  const dataVersionRows = yield* sql`SELECT data_version AS dataVersion FROM pragma_data_version`;
  const [dataVersionRow] = yield* Schema.decodeUnknownEffect(DataVersionRowsSchema)(dataVersionRows);

  return dataVersionRow.dataVersion;
});

// data_version changes with each commit from another connection (aggregor-pty, another window), never with this one's
// own, which every repository re-reads after anyway. The poll runs untraced, like the spinner; only a change refreshes.
export const refreshOnDatabaseChanges = Effect.fn("BaseRepository.refreshOnDatabaseChanges")(
  function* (refresh: Effect.Effect<void>) {
    const dataVersions = Stream.fromEffectSchedule(
      Effect.withTracerEnabled(readDataVersion(), false),
      Schedule.spaced(DATABASE_POLL_INTERVAL)
    );

    yield* Stream.runForEach(Stream.drop(Stream.changes(dataVersions), 1), () => refresh);
  },
  Effect.ignore({log: "Warn", message: "Could not watch the database for other windows' and agents' changes"})
);
