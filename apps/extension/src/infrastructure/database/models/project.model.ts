import {BASE_COLUMNS} from "@models/base.model.ts";
import {integer, sqliteTable, text} from "drizzle-orm/sqlite-core";

export const ProjectTableModel = sqliteTable("projects", {
  ...BASE_COLUMNS,
  isAdded: integer({mode: "boolean"}).notNull().default(false),
  path: text().notNull().unique(),
  settings: text().notNull().default("{}")
});
