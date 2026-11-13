// data/aggregor.db in the Aggregor folder unless the variable names another, as for a test.
export const DATABASE_FILE = {
  ENVIRONMENT_VARIABLE: "AGGREGOR_DATABASE_FILE",
  FILE_NAME: "aggregor.db",
  FOLDER_NAME: "data"
} as const;

export const DATABASE_POLL_INTERVAL = "250 millis";

// drizzle-kit writes the migrations into the folder, and the migrator records each one a database has run in the table.
export const MIGRATIONS = {
  FOLDER: "assets/migrations",
  RECORD_TABLE: "__drizzle_migrations"
} as const;

// Named after the first migration the database hadn't run; only the latest is kept.
export const DATABASE_BACKUP = {
  FILE_NAME: (firstPendingMigrationName: string) => `aggregor.before-${firstPendingMigrationName}.db`,
  FILE_NAME_PREFIX: "aggregor.before-",
  WRITE_AHEAD_LOG_SUFFIX: "-wal"
} as const;

export const DATABASE_ERRORS = {
  READ_FAILED: "Could not read Aggregor's database. The trace log has the reason.",
  WRITE_FAILED: "Could not save to Aggregor's database. The trace log has the reason."
} as const;
