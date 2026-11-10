import {SqliteClient} from "@effect/sql-sqlite-node";
import {getAggregorFolderPath, readAbsolutePathVariable} from "@infraUtils/aggregorFolder.utils.ts";
import {DATABASE_BACKUP, DATABASE_FILE, MIGRATIONS} from "@pkg/constants/src/database.constant.ts";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {migrate} from "drizzle-orm/effect-sqlite-node/migrator";
import {Array, Effect, Order, Schema, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {make as makeReactivity, Reactivity} from "effect/reactivity/Reactivity";
import {SqlClient} from "effect/sql/SqlClient";

// The database has run every migration in the folder, or is new and holds nothing to back up.
class NoPendingMigrationError extends Schema.TaggedError<NoPendingMigrationError, {readonly brand: unique symbol}>()(
  "NoPendingMigrationError",
  {}
) {}

class DatabaseFileNotFoundError extends Schema.TaggedError<
  DatabaseFileNotFoundError,
  {readonly brand: unique symbol}
>()("DatabaseFileNotFoundError", {}) {}

// The window opens it, and each session's aggregor-pty writes its agent's status to it and its errors beside it.
export const getDatabaseFilePath = Effect.fn("getDatabaseFilePath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return yield* readAbsolutePathVariable(
    DATABASE_FILE.ENVIRONMENT_VARIABLE,
    path.join(aggregorFolderPath, DATABASE_FILE.FOLDER_NAME, DATABASE_FILE.FILE_NAME)
  );
});

// Matched by name, as the migrator matches them. A new database has no record of migrations.
const findFirstPendingMigrationName = Effect.fn("findFirstPendingMigrationName")(function* (
  migrationsFolderPath: string
) {
  const sql = yield* SqlClient;
  const fileSystem = yield* FileSystem;
  const recordTables =
    yield* sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${MIGRATIONS.RECORD_TABLE}`;
  if (recordTables.length === 0) return yield* NoPendingMigrationError.make();
  const appliedMigrations = yield* sql<{readonly name: string}>`SELECT name FROM ${sql(MIGRATIONS.RECORD_TABLE)}`;
  const appliedMigrationNames = new Set(Array.map(appliedMigrations, (appliedMigration) => appliedMigration.name));
  const migrationNames = yield* fileSystem.readDirectory(migrationsFolderPath);
  const [firstPendingMigrationName] = Array.filter(
    Array.sort(migrationNames, Order.String),
    (migrationName) => !appliedMigrationNames.has(migrationName)
  );
  if (firstPendingMigrationName === undefined) return yield* NoPendingMigrationError.make();

  return firstPendingMigrationName;
});

const readOpenDatabaseFilePath = Effect.fn("readOpenDatabaseFilePath")(function* () {
  const sql = yield* SqlClient;
  const [mainDatabase] = yield* sql<{readonly file: string}>`SELECT file FROM pragma_database_list WHERE name = 'main'`;
  if (mainDatabase === undefined || mainDatabase.file === "") return yield* DatabaseFileNotFoundError.make();

  return mainDatabase.file;
});

// On a second, read-only connection: VACUUM can't run inside the migrations' transaction, and a reader still sees the
// database as it was before them while that transaction holds the write lock.
const vacuumDatabaseInto = Effect.fn("vacuumDatabaseInto")(
  function* (databaseFilePath: string, backupFilePath: string) {
    const readOnlySql = yield* SqliteClient.make({filename: databaseFilePath, readonly: true});

    yield* readOnlySql`VACUUM INTO ${backupFilePath}`;
  },
  Effect.scoped,
  Effect.provideServiceEffect(Reactivity, makeReactivity)
);

// The migrations' transaction holds the write lock, so nothing commits while the database file and its write-ahead log
// are copied.
const copyDatabaseFiles = Effect.fn("copyDatabaseFiles")(function* (databaseFilePath: string, backupFilePath: string) {
  const fileSystem = yield* FileSystem;
  const writeAheadLogFilePath = `${databaseFilePath}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`;
  yield* fileSystem.copyFile(databaseFilePath, backupFilePath);
  if (yield* fileSystem.exists(writeAheadLogFilePath))
    yield* fileSystem.copyFile(writeAheadLogFilePath, `${backupFilePath}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`);
});

// VACUUM INTO, or a copy of the files when that fails.
const writeBackup = Effect.fn("writeBackup")(
  function* (databaseFilePath: string, backupFilePath: string) {
    yield* vacuumDatabaseInto(databaseFilePath, backupFilePath);
  },
  (effect, databaseFilePath, backupFilePath) =>
    Effect.catch(effect, () => copyDatabaseFiles(databaseFilePath, backupFilePath))
);

// A backup of the same name, left by a migration that failed, holds an older state of the database.
const removeBackupFiles = Effect.fn("removeBackupFiles")(function* (backupFilePath: string) {
  const fileSystem = yield* FileSystem;
  yield* fileSystem.remove(backupFilePath, {force: true});
  yield* fileSystem.remove(`${backupFilePath}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`, {force: true});
});

const removeOlderBackups = Effect.fn("removeOlderBackups")(function* (backupFilePath: string) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const backupFolderPath = path.dirname(backupFilePath);
  const backupFileName = path.basename(backupFilePath);
  const keptFileNames = new Set([`${backupFileName}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`, backupFileName]);
  const backupFolderFileNames = yield* fileSystem.readDirectory(backupFolderPath);
  const olderBackupFileNames = Array.filter(
    backupFolderFileNames,
    (fileName) => String.startsWith(DATABASE_BACKUP.FILE_NAME_PREFIX)(fileName) && !keptFileNames.has(fileName)
  );

  yield* Effect.forEach(olderBackupFileNames, (fileName) => fileSystem.remove(path.join(backupFolderPath, fileName)));
});

// A copy of the database before the migrations change it, beside it. When none can be written the migrations still run,
// in their transaction, and the warning says so.
const backUpBeforeMigrating = Effect.fn("backUpBeforeMigrating")(
  function* (migrationsFolderPath: string) {
    const path = yield* Path;
    const firstPendingMigrationName = yield* findFirstPendingMigrationName(migrationsFolderPath);
    const databaseFilePath = yield* readOpenDatabaseFilePath();
    const backupFilePath = path.join(
      path.dirname(databaseFilePath),
      DATABASE_BACKUP.FILE_NAME(firstPendingMigrationName)
    );
    yield* removeBackupFiles(backupFilePath);

    yield* writeBackup(databaseFilePath, backupFilePath);
    yield* removeOlderBackups(backupFilePath);
  },
  Effect.catchTag("NoPendingMigrationError", () => Effect.void),
  Effect.catch((backupError) =>
    Effect.logWarning("Could not back up the database before migrating it; migrating anyway", backupError)
  )
);

// Backs up the database, then runs the folder's migrations it hasn't run. A migration that rebuilds a table drops it,
// which foreign keys block, and the setting can't change inside a transaction. The one transaction holds SQLite's write
// lock from before the backup to the last migration, so a second window starting at once waits for it, up to the
// client's busy timeout, and then finds nothing pending; a failed migration leaves the database as it was.
export const applyPendingMigrations = Effect.fn("applyPendingMigrations")(function* (migrationsFolderPath: string) {
  const sql = yield* SqlClient;
  const database = yield* makeWithDefaults();
  yield* sql`PRAGMA foreign_keys = OFF`;
  yield* sql.withTransaction(
    Effect.andThen(
      backUpBeforeMigrating(migrationsFolderPath),
      migrate(database, {migrationsFolder: migrationsFolderPath})
    )
  );
  yield* sql`PRAGMA foreign_keys = ON`;
});
