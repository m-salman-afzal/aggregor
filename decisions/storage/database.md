# Database

The SQLite tables, their rows and how they are read.

## Projects and sessions live in SQLite

- **Problem:** `aggregor-pty` (harness-foundation 2) must write each session's status from outside VS Code, and the data
  has relations: a project has many sessions.
- **Decision:** `~/.aggregor/data/aggregor.db` (`AGGREGOR_HOME` moves the Aggregor folder; see its entry), opened with
  `@effect/sql-sqlite-node` on Node's built-in `node:sqlite` (VS Code 1.145's Electron has Node 24.22 and SQLite
  3.53.4), in WAL mode with foreign keys on. The tables are `projects` and `sessions`, every name camelCase, defined and
  migrated through Drizzle (see its entry). Both SQL modules are unstable Effect APIs, allowed by name in
  `tsconfig.base.json`. A file any process can write, real relations, and no native module to ship.
- **Alternatives considered:** `globalState`: one JSON value per key, read-modify-written by every window, out of reach
  of other processes. A native SQLite module, which needs a build per Electron version.

## A base entity, a base repository and a base service

- **Problem:** with related tables, every repository would repeat the same reads, writes and soft deletes, and every
  entity the same id and timestamps.
- **Decision:** `BaseEntity` holds `id`, `sortId`, `updatedAt` and `deletedAt`, and every entity stored in the database
  extends it (`AgentEntity`, which lives in the settings, does not). `IBaseRepository` and `makeBaseRepository` give
  `add`, `findById`, `findMany`, `update`, `upsert` and `softDelete`. Reads skip soft-deleted rows and follow `sortId`;
  `upsert` brings a soft-deleted row back; `update` writes only the columns it is given, so the extension and
  `aggregor-pty` never overwrite each other's. `base.service.ts` has the same six calls for any repository, which the
  entity services use instead of their repositories. Each new table is a Drizzle table, its generated migration, an
  entity and a few lines of repository.
- **Alternatives considered:** Effect's `SqlModel.makeRepository`: its reads are `select *`, so a row can't carry what
  it reads through a join (a session's project path); its update writes the whole row outside a transaction; its soft
  delete writes `CURRENT_TIMESTAMP`, which isn't ISO text. No base service: the services are use cases, and a base one
  only forwards to the repository; the user picked it as the foundation.

## Rows are read through the entity's factory; entities don't know how they're stored

- **Problem:** stored rows carry NULLs and timestamps as text, not what the domain uses.
- **Decision:** entities are plain `Schema.Class`es with domain types. `BaseEntity.fromRow` turns NULL into an absent
  field and the ISO text of `updatedAt` and `deletedAt` into a `DateTime`, then decodes the row into the entity; the
  base repository passes every row it returns through it, and writes plain columns. The domain stays storage-agnostic,
  services only ever receive entities, and the cleanup lives in one place. A `Model.Class` earns its place where the
  stored or wire shape is its own thing: a row model in infrastructure once a table's columns differ a lot from its
  entity, or the messages of an HTTP or socket API through its `json` variants.
- **Alternatives considered:** entities as Effect `Model.Class`es (tried and reverted the same day): one schema per
  table with insert and update variants, but the domain entity then knows how it is stored, such as which columns the
  database generates and that timestamps are text. A `Model.Class` row model per table in infrastructure beside each
  entity, which repeats the entity's fields for four small tables. Services calling the factory themselves, which hands
  rows to the application layer.

## Every row has a `sortId`

- **Problem:** the user will move projects and sessions up and down, so rows need an order of their own, apart from when
  they were made.
- **Decision:** a `sortId INTEGER NOT NULL` base column. The base repository gives a written row the table's highest
  `sortId` plus one, in the statement that writes it; `upsert` does the same for the row it brings back, so an
  added-again project moves to the end. Reads list rows in `sortId` order. Moving a row places it, and the rows after
  its new place, after every other row (see "Projects and sessions move up and down"). A writing statement holds
  SQLite's write lock, so two windows never get the same `sortId`; soft-deleted rows keep theirs, so none is reused.
- **Alternatives considered:** SQLite's `AUTOINCREMENT`, which works only on an integer primary key, and the key is the
  UUID v7 `id`. Ordering by `updatedAt`, which every write changes.

## Timestamps are stored as ISO 8601 text in UTC

- **Problem:** `updatedAt`, `deletedAt` and later timestamps need one stored format that the extension, `aggregor-pty`
  and a person reading the database all agree on.
- **Decision:** text such as `2026-11-07T22:13:46.836Z`: `DateTime.formatIso` in the extension, and SQLite's
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` in `aggregor-pty`, which give the same shape. Entities hold `DateTime.Utc`,
  parsed in `BaseEntity.fromRow`. Readable in the database, sorts in time order as text, and SQLite's date functions
  read it.
- **Alternatives considered:** milliseconds since the epoch as an integer: smaller, but unreadable in `sqlite3`.

## One UUID v7 id per row

- **Problem:** every table was to carry an auto-increment `id`, a random `uuid` and `createdAt`.
- **Decision:** one `id` column holding a UUID v7, the `EntityIdValueObject` every entity's id is. Its factory service,
  `entityId.domainService.ts`, makes ids (`makeEntityId`, on Effect's `SecureRandom.uuidV7`) and reads their creation
  time (`getEntityIdCreatedAt`); ids sort by creation time as text. A session's id is also its agent's session id, so
  `SessionIdValueObject` folded into it. Claude Code accepts a UUID v7 for `--session-id`. One column gives uniqueness,
  creation order and creation time, and stays unique across machines.
- **Alternatives considered:** all three columns, with relations on the integer id, which collides between databases.

## Drizzle on Effect defines the tables, builds the queries and generates the migrations

- **Problem:** the tables must be created and later changed, and the user wanted Effect's ecosystem to do that work
  rather than hand-written SQL.
- **Decision:** `drizzle-orm` 1.0.0-rc.5, pinned, through its own Effect 4 driver `drizzle-orm/effect-sqlite-node`,
  which runs on the same `@effect/sql-sqlite-node` client; `drizzle-kit` 1.0.0-rc.5 for development.
  - Each `infrastructure/database/models/<table>.model.ts` is a `sqliteTable` (`ProjectTableModel`...) spreading
    `BASE_COLUMNS` from `base.model.ts`.
  - `pnpm db:generate` (`drizzle-kit generate`, configured in `apps/extension/drizzle.config.ts`) writes the migrations
    into `apps/extension/assets/migrations/`, committed and shipped in the VSIX without drizzle-kit's snapshots, one per
    schema change (see "Every schema change is a migration on the user's database").
  - `DatabaseLayer` runs Drizzle's `migrate` when a window starts, in one `BEGIN IMMEDIATE` transaction so a second
    window starting at once sees the first one's migrations, with foreign keys off around it so a migration can rebuild
    a table.
  - The base repository builds its queries with Drizzle's builder; a repository passes a join for the columns it reads
    from another table (a session's `projectPath`), and `upsert` conflicts on the table's unique columns, read from the
    table.

  Each table is declared once, in TypeScript, and drizzle-kit derives its migrations, including SQLite's table rebuilds;
  queries still run through Effect's client and show in the trace. `aggregor-pty` writes plain SQL against the same
  tables. Costs: a release candidate; every query error is one `EffectDrizzleQueryError`, which the base repository maps
  to `DatabaseReadError` or `DatabaseWriteError`; generated SQL needs reading before it is committed; about 120 KB of
  bundle. drizzle-kit writes no `NOT NULL` on a text primary key, which SQLite then lets be NULL; every id comes from
  `makeEntityId`.

- **Alternatives considered:** hand-written `CREATE TABLE`s, one file per table, with `PRAGMA user_version` dropping and
  creating them again on a mismatch. Effect's `Model.Class` with `SqlModel.makeRepository` behind our base repository: a
  Model knows no column types or constraints, so it can't create tables, Effect's `Migrator` runs hand-written
  migrations, every column would be declared three times (entity, Model, migration), and only `insert` and `findById`
  fit our base repository. The `@effect/sql-drizzle` and `@effect/sql-kysely` adapters, which need Effect 3. An
  `effect-orm` project, not evaluated.

## Windows see outside writes by polling `data_version`, and read only the rows written

- **Problem:** `aggregor-pty` and other windows write the database, and a window has to notice within a moment and know
  which rows changed, without keeping a copy to compare against.
- **Decision:** each repository's change feed (`entityChange.utils.ts`) looks again when `PRAGMA data_version` moves,
  read every 250 ms, untraced, which only another connection's commit does, and right after each of the window's own
  writes. A look reads the rows whose `updatedAt` is at or after the latest one it read, soft-deleted ones too, skips
  those it already read unchanged at that same millisecond, and calls a row placed when its `sortId` is above every one
  it saw (new, or moved; `added` before), removed when it has `deletedAt`, else updated. It publishes each as an
  `EntityChange`, whose kind is `EntityChangeKindValueObject` (`ENTITY_CHANGE_KINDS`); a failed look leaves the cursor
  where it was. One small query per write, no copy of the data, and a status shows within a quarter second. A clock that
  steps back could hide a write until the row's next one; the counter column is the fix if that ever shows.
- **Alternatives considered:** re-reading when the window regains focus, which misses every status change while you look
  at the window. Watching the WAL file, which a checkpoint recreates and which doesn't exist before the first write. A
  socket from the binary, planned for later. Re-reading every row into a copy per window on each change (the first
  build), which the view then diffed. A change counter column kept by a trigger: exact and immune to the clock, but a
  column and triggers on every table.

## One column per dimension

- **Problem:** archiving sessions would have added another boolean column to `sessions`. The user asked whether flags
  such as `hasWorked` and an archived flag should become one status column, a state machine, and for a rule to follow
  from now on.
- **Decision:** `DDD.md`'s Tables and migrations. A column per thing that changes on its own, with one writer. A stage
  is one enum column even with two values; each action checks the stage it starts from, the row's context value carries
  the stage, and a transition map comes with a third value. Booleans about one thing merge into its stage column. A
  boolean column is for a yes-or-no fact that isn't a stage. Nothing merges today: `status` is already a stage column
  with its details beside it, and `hasWorked` and `isAdded` are such facts. A stage column keeps the states and the
  actions each allows in one place without multiplying them, and one writer per column keeps `aggregor-pty`'s writes and
  the extension's apart.
- **Alternatives considered:**
  - One stage column holding `hasWorked`, archived and the like: they change independently, so it would need a value per
    combination (28, with the agent's 7 statuses), and `aggregor-pty` and the extension would both write it.
  - A lint banning boolean columns: whether a flag is a stage takes judgement, which a lint can't make.
