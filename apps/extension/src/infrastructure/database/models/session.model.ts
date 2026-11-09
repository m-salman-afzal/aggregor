import {BASE_COLUMNS} from "@models/base.model.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {integer, sqliteTable, text} from "drizzle-orm/sqlite-core";

// aggregor-pty (apps/pty) alone writes the status and title columns, from the agent's OSC 7501 reports and window title;
// the extension writes the rest.
export const SessionTableModel = sqliteTable("sessions", {
  ...BASE_COLUMNS,
  customName: text(),
  harnessId: text().notNull(),
  hasWorked: integer({mode: "boolean"}).notNull().default(false),
  name: text().notNull(),
  projectId: text()
    .notNull()
    .references(() => ProjectTableModel.id),
  reportedTitle: text(),
  status: text().notNull().default("unknown"),
  statusChangedAt: text(),
  statusKind: text(),
  statusMessage: text(),
  statusProgress: integer(),
  terminalTitle: text(),
  viewedAt: text()
});
