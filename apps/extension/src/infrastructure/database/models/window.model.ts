import {BASE_COLUMNS} from "@models/base.model.ts";
import {sqliteTable, text} from "drizzle-orm/sqlite-core";

export const WindowTableModel = sqliteTable("windows", {...BASE_COLUMNS, key: text().notNull().unique()});
