import {BASE_COLUMNS} from "@models/base.model.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {sqliteTable, text} from "drizzle-orm/sqlite-core";

export const SessionTableModel = sqliteTable("sessions", {
  ...BASE_COLUMNS,
  customName: text(),
  harnessId: text().notNull(),
  name: text().notNull(),
  projectId: text()
    .notNull()
    .references(() => ProjectTableModel.id)
});
