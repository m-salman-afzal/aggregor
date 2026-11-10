// The database file: data/aggregor.db in the Aggregor folder unless the variable names another, as for a test.
export const DATABASE_FILE = {
  ENVIRONMENT_VARIABLE: "AGGREGOR_DATABASE_FILE",
  FILE_NAME: "aggregor.db",
  FOLDER_NAME: "data"
} as const;

// How often a window checks the database for other connections' writes, such as aggregor-pty's statuses.
export const DATABASE_POLL_INTERVAL = "250 millis";

// drizzle-kit writes the migrations here (apps/extension/drizzle.config.ts).
export const MIGRATIONS_FOLDER = "assets/migrations";

export const DATABASE_ERRORS = {
  READ_FAILED: "Could not read Aggregor's database. The trace log has the reason.",
  WRITE_FAILED: "Could not save to Aggregor's database. The trace log has the reason."
} as const;
