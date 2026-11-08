import {getTableConfig} from "drizzle-orm/sqlite-core";
import {Array, DateTime, Effect, Record} from "effect";

import type {BaseTableModel, StoredColumns} from "@repositories/base/base.repository.type.ts";

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
