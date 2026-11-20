import {NodeServices} from "@effect/platform-node";
import {SqliteClient} from "@effect/sql-sqlite-node";
import {AggregorFolderUtils} from "@infraUtils/aggregorFolder.utils.ts";
import {DATABASE_BACKUP, DATABASE_FILE, MIGRATIONS} from "@pkg/constants/src/database.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {makeWithDefaults} from "drizzle-orm/effect-sqlite-node";
import {migrate} from "drizzle-orm/effect-sqlite-node/migrator";
import {Array, Context, Effect, Layer, Order, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {make as makeReactivity, Reactivity} from "effect/reactivity/Reactivity";
import {SqlClient} from "effect/sql/SqlClient";

class DatabaseUtilsErrors extends TaggedErrors({
  DatabaseFileNotFoundError: {},
  NoPendingMigrationError: {}
}) {}

export class DatabaseUtils extends Context.Service<DatabaseUtils>()(
  "aggregor-app/infrastructure/utils/database.utils/DatabaseUtils",
  {
    make: Effect.fn("make")(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const aggregorFolderUtils = yield* AggregorFolderUtils;

      const getDatabaseFilePath = Effect.fn("getDatabaseFilePath")(function* () {
        const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;

        return yield* aggregorFolderUtils.readAbsolutePathVariable(
          DATABASE_FILE.ENVIRONMENT_VARIABLE,
          path.join(aggregorFolderPath, DATABASE_FILE.FOLDER_NAME, DATABASE_FILE.FILE_NAME)
        );
      });

      // Matched by name, as the migrator matches them.
      const findFirstPendingMigrationName = Effect.fn("findFirstPendingMigrationName")(function* (
        migrationsFolderPath: string
      ) {
        // eslint-disable-next-line no-restricted-syntax -- the caller opens the database, so its client comes with each call
        const sql = yield* SqlClient;
        const recordTables =
          yield* sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${MIGRATIONS.RECORD_TABLE}`;
        if (recordTables.length === 0) return yield* DatabaseUtilsErrors.NoPendingMigrationError.make();
        const appliedMigrations = yield* sql<{readonly name: string}>`SELECT name FROM ${sql(MIGRATIONS.RECORD_TABLE)}`;
        const appliedMigrationNames = new Set(
          Array.map(appliedMigrations, (appliedMigration) => appliedMigration.name)
        );
        const migrationNames = yield* fileSystem.readDirectory(migrationsFolderPath);
        const [firstPendingMigrationName] = Array.filter(
          Array.sort(migrationNames, Order.String),
          (migrationName) => !appliedMigrationNames.has(migrationName)
        );
        if (firstPendingMigrationName === undefined) return yield* DatabaseUtilsErrors.NoPendingMigrationError.make();

        return firstPendingMigrationName;
      });

      const readOpenDatabaseFilePath = Effect.fn("readOpenDatabaseFilePath")(function* () {
        // eslint-disable-next-line no-restricted-syntax -- the caller opens the database, so its client comes with each call
        const sql = yield* SqlClient;
        const [mainDatabase] = yield* sql<{
          readonly file: string;
        }>`SELECT file FROM pragma_database_list WHERE name = 'main'`;
        if (mainDatabase === undefined || mainDatabase.file === "")
          return yield* DatabaseUtilsErrors.DatabaseFileNotFoundError.make();

        return mainDatabase.file;
      });

      // A second, read-only connection: VACUUM can't run inside the migrations' transaction.
      const vacuumDatabaseInto = Effect.fn("vacuumDatabaseInto")(
        function* (databaseFilePath: string, backupFilePath: string) {
          const readOnlySql = yield* SqliteClient.make({filename: databaseFilePath, readonly: true});

          yield* readOnlySql`VACUUM INTO ${backupFilePath}`;
        },
        Effect.scoped,
        Effect.provideServiceEffect(Reactivity, makeReactivity)
      );

      // The migrations' transaction holds the write lock, so nothing commits while the files are copied.
      const copyDatabaseFiles = Effect.fn("copyDatabaseFiles")(function* (
        databaseFilePath: string,
        backupFilePath: string
      ) {
        const writeAheadLogFilePath = `${databaseFilePath}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`;
        yield* fileSystem.copyFile(databaseFilePath, backupFilePath);
        if (yield* fileSystem.exists(writeAheadLogFilePath))
          yield* fileSystem.copyFile(
            writeAheadLogFilePath,
            `${backupFilePath}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`
          );
      });

      const writeBackup = Effect.fn("writeBackup")(
        function* (databaseFilePath: string, backupFilePath: string) {
          yield* vacuumDatabaseInto(databaseFilePath, backupFilePath);
        },
        (effect, databaseFilePath, backupFilePath) =>
          Effect.catch(effect, () => copyDatabaseFiles(databaseFilePath, backupFilePath))
      );

      // A backup of the same name, left by a migration that failed, holds an older state of the database.
      const removeBackupFiles = Effect.fn("removeBackupFiles")(function* (backupFilePath: string) {
        yield* fileSystem.remove(backupFilePath, {force: true});
        yield* fileSystem.remove(`${backupFilePath}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`, {force: true});
      });

      const removeOlderBackups = Effect.fn("removeOlderBackups")(function* (backupFilePath: string) {
        const backupFolderPath = path.dirname(backupFilePath);
        const backupFileName = path.basename(backupFilePath);
        const keptFileNames = new Set([`${backupFileName}${DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX}`, backupFileName]);
        const backupFolderFileNames = yield* fileSystem.readDirectory(backupFolderPath);
        const olderBackupFileNames = Array.filter(
          backupFolderFileNames,
          (fileName) => String.startsWith(DATABASE_BACKUP.FILE_NAME_PREFIX)(fileName) && !keptFileNames.has(fileName)
        );

        yield* Effect.forEach(olderBackupFileNames, (fileName) =>
          fileSystem.remove(path.join(backupFolderPath, fileName))
        );
      });

      const backUpBeforeMigrating = Effect.fn("backUpBeforeMigrating")(
        function* (migrationsFolderPath: string) {
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

      // Foreign keys go off outside the transaction: a table rebuild drops the table, and the setting can't change inside one.
      const applyPendingMigrations = Effect.fn("applyPendingMigrations")(function* (migrationsFolderPath: string) {
        // eslint-disable-next-line no-restricted-syntax -- the caller opens the database, so its client comes with each call
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

      return {applyPendingMigrations, getDatabaseFilePath: getDatabaseFilePath()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("DatabaseUtils", this.make())).pipe(
    Layer.provide([AggregorFolderUtils.layer, NodeServices.layer])
  );
}
