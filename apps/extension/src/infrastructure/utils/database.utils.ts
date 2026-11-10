import {getAggregorFolderPath, readAbsolutePathVariable} from "@infraUtils/aggregorFolder.utils.ts";
import {DATABASE_FILE} from "@pkg/constants/src/database.constant.ts";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {migrate} from "drizzle-orm/effect-sqlite-node/migrator";
import {Effect} from "effect";
import {Path} from "effect/Path";
import {SqlClient} from "effect/sql/SqlClient";

// The window opens it, and each session's aggregor-pty writes its agent's status to it and its errors beside it.
export const getDatabaseFilePath = Effect.fn("getDatabaseFilePath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return yield* readAbsolutePathVariable(
    DATABASE_FILE.ENVIRONMENT_VARIABLE,
    path.join(aggregorFolderPath, DATABASE_FILE.FOLDER_NAME, DATABASE_FILE.FILE_NAME)
  );
});

// Runs the folder's migrations the database hasn't run yet, by name. A migration that rebuilds a table drops it, which
// foreign keys block, and the setting can't change inside a transaction. The one write transaction makes a second window
// starting at once see the first one's migrations, and a failed migration leaves the database as it was.
export const applyPendingMigrations = Effect.fn("applyPendingMigrations")(function* (migrationsFolderPath: string) {
  const sql = yield* SqlClient;
  const database = yield* makeWithDefaults();
  yield* sql`PRAGMA foreign_keys = OFF`;
  yield* sql.withTransaction(migrate(database, {migrationsFolder: migrationsFolderPath}));
  yield* sql`PRAGMA foreign_keys = ON`;
});
