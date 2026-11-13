# Migrations

How stored data survives an update.

## No users before 0.1.0, but their data stays

- **Decision:** rename command IDs, setting keys and storage keys, with no shims. Stored data survives every update: see
  "Every schema change is a migration on the user's database". Until 0.1.0 the author is the only user. Sessions moved
  keys four times (`sessions`, `storedSessions`, `savedSessions`, `agentSessions`).
- **Alternatives considered:** changing stored data too, with no migrations: the old database deleted on a schema change
  .

## Every schema change is a migration on the user's database

- **Problem:** before 0.1.0 a schema change regenerated the one migration from zero and deleted the old database, so an
  update that changed the schema lost every project and session. The installed build's database held 7 sessions and 4
  projects when archiving sessions first needed a column.
- **Decision:**
  - A migration per schema change, run on the user's database when a window starts; no database is deleted. A release's
    migration only adds; renaming or dropping a column takes two releases; a migration that moves data adds its SQL and
    its own check; a released migration is never edited (`DDD.md`'s Tables and migrations).
  - `applyPendingMigrations` (`database.utils.ts`) runs a folder's pending migrations, split out of `DatabaseLayer` so a
    test runs the same code on any folder.
  - vitest 5.1.0 runs `apps/extension/tests` (`pnpm test`); `vitest.config.ts` resolves the tsconfig aliases, and each
    test runs its effect with `Effect.runPromise`.
  - `migrations.test.ts` runs every migration on a new database. For each migration it builds a database at that one,
    fills every table from SQLite's own description of it, migrates it to the newest, and checks that every table, row
    and value is still there, that new columns hold their defaults, that `integrity_check` and `foreign_key_check` are
    clean, and that a second run changes nothing. Throwaway migrations that dropped a column, deleted rows, changed
    values, broke a reference or filled a new column each failed it; one that added a column and one drizzle-kit wrote
    to rebuild a table each passed.
  - `pnpm db:check` runs `drizzle-kit generate` into a copy of the migrations and fails when it writes one, so a model
    can't change without its migration. CI runs both.
  - Before a release with a migration, the build runs against a copy of a real database (`AGGREGOR_DATABASE_FILE`).

  An update must never cost the user their sessions. The test needs no data written for each migration, so every future
  migration is checked from every earlier one, which also covers a user who skipped updates.

- **Solution:** Explainer: [How Aggregor Migrates](https://claude.ai/artifact/SYxmCSR49KKUD5uvqQuEVt), each step of a
  migration run linked to its code.
- **Alternatives considered:**
  - Regenerating and deleting until 0.1.0.
  - Checking migrations only by hand, against a copy of a real database.
  - Node's own test runner, with no new dependency: it can't resolve the extension's tsconfig aliases, so it would run
    Drizzle's migrator directly instead of ours. `@effect/vitest`, whose every export `@effect/tsgo` reports as an
    unstable API.
  - `drizzle-kit check` in CI: it checks the migrations folder, not that the models match it.

## The database is backed up before it migrates

- **Problem:** a migration that passes the migration test can still lose something the test didn't foresee, and the user
  would have no way back to their projects and sessions.
- **Decision:**
  - `applyPendingMigrations` backs up an existing database that has migrations to run, inside the migrations'
    transaction, before them. That transaction's `BEGIN IMMEDIATE` holds SQLite's write lock, so a second window waits
    for the first one's backup and migrations, up to the client's 5-second busy timeout, and then finds nothing to run.
  - `VACUUM INTO data/aggregor.before-<first pending migration>.db`, on a second, read-only connection, Effect's own
    (`SqliteClient.make`, given a `Reactivity` of its own, a module `tsconfig.base.json` now allows by name): `VACUUM`
    can't run inside a transaction, and a reader still sees the database from before the migrations. When it fails, the
    database file and its write-ahead log are copied instead; nothing else commits while the lock is held. When that
    fails too, a warning is logged and the migrations still run, in their transaction.
  - A backup of the same name, left by a migration that failed, is replaced; older backups are deleted once a new one is
    written.
  - The migration test checks that the backup holds every row from before and replaced the older one, and that a
    database with nothing to run writes none. Forcing `VACUUM INTO` to fail, with a throwaway migration, showed the copy
    holding the same rows.
  - Going back is by hand, written in `storage.md`.

  An update must never cost the user their sessions, and SQLite's own write lock is the one lock every window and
  `aggregor-pty` already share.

- **Solution:** a backup that takes longer than the busy timeout makes a second window starting at once fail to start
  until it reloads. The file-copy path isn't covered by a test that runs every time.
- **Alternatives considered:**
  - Copying the database file alone: it misses writes still in the write-ahead log, which held 3.4 MB beside a 28 KB
    file in the installed build's database.
  - Keeping every backup; failing to start, or migrating at once, when `VACUUM INTO` fails.
  - For two windows starting at once: each writing its backup under a temporary name and linking it into place only when
    none exists. An Effect lock (a `Semaphore`) only orders fibers inside one window's extension host, and each window
    is its own process.
  - For the second connection: `SqliteClient.layer` through `Effect.provide`, which the Effect rules reject outside an
    entry point (`strictEffectProvide`); `node:sqlite` itself, the driver under Effect's client (built first, the same
    day), which left that one query outside Effect's client and its trace.
