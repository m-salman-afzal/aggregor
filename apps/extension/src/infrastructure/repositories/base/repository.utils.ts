import {eq, getColumns, isNull} from "drizzle-orm";
import {getTableConfig} from "drizzle-orm/sqlite-core";
import {Array, DateTime, Effect, Record} from "effect";

import type {BaseTableModel, StoredColumns} from "@repositories/base/base.repository.type.ts";
import type {SQLiteColumn} from "drizzle-orm/sqlite-core";

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
