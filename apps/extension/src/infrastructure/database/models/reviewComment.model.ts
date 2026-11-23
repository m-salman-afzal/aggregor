import {BASE_COLUMNS} from "@models/base.model.ts";
import {integer, sqliteTable, text} from "drizzle-orm/sqlite-core";

export const ReviewCommentTableModel = sqliteTable("reviewComments", {
  ...BASE_COLUMNS,
  body: text().notNull(),
  endLine: integer().notNull(),
  filePath: text().notNull(),
  startLine: integer().notNull()
});
