import {integer, text} from "drizzle-orm/sqlite-core";

export const BASE_COLUMNS = {
  deletedAt: text(),
  id: text().primaryKey(),
  sortId: integer().notNull().default(0),
  updatedAt: text().notNull()
};
