import {SqliteClient} from "@effect/sql-sqlite-node";
import {DATA_DIRECTORY_ENV, MIGRATIONS_FOLDER} from "@pkg/constants/src/extension.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {migrate} from "drizzle-orm/effect-sqlite-node/migrator";
import {Config, Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {SqlClient} from "effect/sql/SqlClient";
import {homedir} from "node:os";

const DATABASE_FILE_NAME = "aggregor.db";

const openDatabaseFile = Effect.fn("Database.openDatabaseFile")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const dataDirectoryPath = yield* Config.withDefault(
    Config.String(DATA_DIRECTORY_ENV),
    path.join(homedir(), ".aggregor")
  );
  yield* fileSystem.makeDirectory(dataDirectoryPath, {mode: 0o700, recursive: true});

  return SqliteClient.layer({filename: path.join(dataDirectoryPath, DATABASE_FILE_NAME)});
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
