export const DATA_DIRECTORY_ENV = "AGGREGOR_DATA_DIR";

// How often a window checks the database for other connections' writes, such as aggregor-pty's statuses.
export const DATABASE_POLL_INTERVAL = "250 millis";

// drizzle-kit writes the migrations here (apps/extension/drizzle.config.ts).
export const MIGRATIONS_FOLDER = "assets/migrations";

export const DATABASE_ERRORS = {
  READ_FAILED: "Could not read Aggregor's database in ~/.aggregor. The trace log has the reason.",
  WRITE_FAILED: "Could not save to Aggregor's database in ~/.aggregor. The trace log has the reason."
} as const;
