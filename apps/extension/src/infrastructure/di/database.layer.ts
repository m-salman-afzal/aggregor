import {SqliteClient} from "@effect/sql-sqlite-node";
import {getDatabaseFilePath} from "@infraUtils/database.utils.ts";
import {AGGREGOR_FOLDER} from "@pkg/constants/src/app.constant.ts";
import {MIGRATIONS_FOLDER} from "@pkg/constants/src/database.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {migrate} from "drizzle-orm/effect-sqlite-node/migrator";
import {Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {SqlClient} from "effect/sql/SqlClient";

const openDatabaseFile = Effect.fn("Database.openDatabaseFile")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const databaseFilePath = yield* getDatabaseFilePath();
  yield* fileSystem.makeDirectory(path.dirname(databaseFilePath), {mode: AGGREGOR_FOLDER.MODE, recursive: true});

  return SqliteClient.layer({filename: databaseFilePath});
});

// A migration that rebuilds a table drops it, which foreign keys block, and the setting can't change inside a
// transaction. The one write transaction makes a second window starting at once see the first one's migrations.
const migrateDatabase = Effect.fn("Database.migrateDatabase")(function* () {
  const sql = yield* SqlClient;
  const {extensionUri, Uri} = yield* VsCodeApi;
  const database = yield* makeWithDefaults();
  yield* sql`PRAGMA foreign_keys = OFF`;
  yield* sql.withTransaction(
    migrate(database, {migrationsFolder: Uri.joinPath(extensionUri, MIGRATIONS_FOLDER).fsPath})
  );
  yield* sql`PRAGMA foreign_keys = ON`;
});

export const DatabaseLayer = Layer.effectDiscard(migrateDatabase()).pipe(
  Layer.provideMerge(Layer.unwrap(openDatabaseFile()))
);
