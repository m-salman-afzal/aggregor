import {BASE_COLUMNS} from "@models/base.model.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {integer, sqliteTable, text} from "drizzle-orm/sqlite-core";

// aggregor-pty alone writes the status and title columns and agentSessionId; the extension writes the rest.
export const SessionTableModel = sqliteTable("sessions", {
  ...BASE_COLUMNS,
  agentId: text().notNull(),
  agentSessionId: text(),
  customName: text(),
  hasWorked: integer({mode: "boolean"}).notNull().default(false),
  lifecycle: text().notNull().default(SESSION_LIFECYCLES.ONGOING),
  name: text().notNull(),
  projectId: text()
    .notNull()
    .references(() => ProjectTableModel.id),
  reportedTitle: text(),
  status: text().notNull().default(AGENT_STATUSES.UNKNOWN),
  statusChangedAt: text(),
  statusKind: text(),
  statusMessage: text(),
  statusProgress: integer(),
  terminalTitle: text(),
  viewedAt: text()
});
