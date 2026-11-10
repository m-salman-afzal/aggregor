// The database file: data/aggregor.db in the Aggregor folder unless the variable names another, as for a test.
export const DATABASE_FILE = {
  ENVIRONMENT_VARIABLE: "AGGREGOR_DATABASE_FILE",
  FILE_NAME: "aggregor.db",
  FOLDER_NAME: "data"
} as const;

// How often a window checks the database for other connections' writes, such as aggregor-pty's statuses.
export const DATABASE_POLL_INTERVAL = "250 millis";

// drizzle-kit writes the migrations into the folder (apps/extension/drizzle.config.ts), and the migrator records each one
// a database has run, by name, in the table.
export const MIGRATIONS = {
  FOLDER: "assets/migrations",
  RECORD_TABLE: "__drizzle_migrations"
} as const;

// The copy of the database taken before migrations change it, beside the database and named after the first migration
// it hadn't run, with the database's write-ahead log beside it when the copy is of the files. Only the latest is kept.
export const DATABASE_BACKUP = {
  FILE_NAME: (firstPendingMigrationName: string) => `aggregor.before-${firstPendingMigrationName}.db`,
  FILE_NAME_PREFIX: "aggregor.before-",
  WRITE_AHEAD_LOG_SUFFIX: "-wal"
} as const;

export const DATABASE_ERRORS = {
  READ_FAILED: "Could not read Aggregor's database. The trace log has the reason.",
  WRITE_FAILED: "Could not save to Aggregor's database. The trace log has the reason."
} as const;
