import {DATABASE_POLL_INTERVAL} from "@pkg/constants/src/database.constant.ts";
import {eq, getColumns, isNull} from "drizzle-orm";
import {getTableConfig} from "drizzle-orm/sqlite-core";
import {Array, DateTime, Effect, Record, Schedule, Schema, Stream} from "effect";
import {SqlClient} from "effect/sql/SqlClient";

import type {BaseTableModel, RepositoryTable, StoredColumns} from "@repositories/base/base.repository.type.ts";
import type {SQL} from "drizzle-orm";
import type {SQLiteColumn} from "drizzle-orm/sqlite-core";

const DataVersionRowsSchema = Schema.Tuple([Schema.Struct({dataVersion: Schema.Int})]);

export const formatCurrentTimestamp = Effect.fn("BaseRepository.formatCurrentTimestamp")(function* () {
  const now = yield* DateTime.now;

  return DateTime.formatIso(now);
});

// A missing value is stored as NULL, and a DateTime as ISO 8601 text, as aggregor-pty writes its timestamps.
export const encodeStoredColumns = Effect.fn("BaseRepository.encodeStoredColumns")(function* (columns: StoredColumns) {
  return Record.map(columns, (columnValue) => {
    if (columnValue === undefined) return null;

    return DateTime.isDateTime(columnValue) ? DateTime.formatIso(columnValue) : columnValue;
  });
});

export const findUniqueColumns = Effect.fn("BaseRepository.findUniqueColumns")(function* (tableModel: BaseTableModel) {
  const tableConfig = getTableConfig(tableModel);
  const uniqueColumns = [
    ...Array.filter(tableConfig.columns, (column) => column.isUnique),
    ...Array.flatMap(tableConfig.uniqueConstraints, (uniqueConstraint) => uniqueConstraint.columns)
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

// data_version changes with each commit from another connection, never this one's own; the poll runs untraced.
export const watchDataVersionChanges = Effect.fn("BaseRepository.watchDataVersionChanges")(function* () {
  const dataVersions = Stream.fromEffectSchedule(
    Effect.withTracerEnabled(readDataVersion(), false),
    Schedule.spaced(DATABASE_POLL_INTERVAL)
  );

  return Stream.drop(Stream.changes(dataVersions), 1);
});

export const selectRows = Effect.fn("BaseRepository.selectRows")(function* <Entity>(
  repositoryTable: RepositoryTable<Entity>,
  rowCondition: SQL | undefined,
  orderColumn: SQLiteColumn
) {
  const joinedColumns = repositoryTable.join === undefined ? {} : repositoryTable.join.joinedColumns;
  const selectedRows = repositoryTable.database
    .select({...getColumns(repositoryTable.tableModel), ...joinedColumns})
    .from(repositoryTable.tableModel)
    .$dynamic();
  const joinedRows =
    repositoryTable.join === undefined
      ? selectedRows
      : selectedRows.innerJoin(repositoryTable.join.joinedTable, repositoryTable.join.joinCondition);

  return yield* joinedRows.where(rowCondition).orderBy(orderColumn);
});
