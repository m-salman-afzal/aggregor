import {BASE_COLUMNS} from "@models/base.model.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {WindowTableModel} from "@models/window.model.ts";
import {sqliteTable, text, unique} from "drizzle-orm/sqlite-core";

export const WindowProjectTableModel = sqliteTable(
  "windowProjects",
  {
    ...BASE_COLUMNS,
    projectId: text()
      .notNull()
      .references(() => ProjectTableModel.id),
    windowId: text()
      .notNull()
      .references(() => WindowTableModel.id)
  },
  (windowProjectTable) => [unique().on(windowProjectTable.windowId, windowProjectTable.projectId)]
);
