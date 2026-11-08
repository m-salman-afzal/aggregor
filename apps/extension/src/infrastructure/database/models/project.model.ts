import {BASE_COLUMNS} from "@models/base.model.ts";
import {sqliteTable, text} from "drizzle-orm/sqlite-core";

export const ProjectTableModel = sqliteTable("projects", {...BASE_COLUMNS, path: text().notNull().unique()});
