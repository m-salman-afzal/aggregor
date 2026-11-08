# Storage

What the extension stores, where, and why. Add an entry whenever something new is stored, and keep every entry to what
is stored now.

Both places are shared by every window and survive reloads, restarts and extension updates.

## The database

`~/.aggregor/aggregor.db` (or `aggregor.db` in `$AGGREGOR_DATA_DIR`), a SQLite file in a folder only its owner can read,
in WAL mode with foreign keys on. Every window opens it through `@effect/sql-sqlite-node`, with Drizzle's query builder.
`infrastructure/database/models/` defines each table as a Drizzle table, one file per table, and `base.model.ts` the
shared columns.

- **Every table** starts with `id` (a UUID v7, which also gives the row's creation time), `sortId` (its place in the
  table's order: a new row, or one upserted again, gets the table's highest plus one, and reads follow it), `updatedAt`
  (set on every write) and `deletedAt` (set by a soft delete; reads skip the row). Timestamps are ISO 8601 text in UTC,
  such as `2026-11-07T22:13:46.836Z`.
- **Migrations:** `apps/extension/assets/migrations/`, one folder per schema change, written by `pnpm db:generate`. A
  window applies the ones the database lacks when it starts, and Drizzle records each applied one in
  `__drizzle_migrations`.
- **Cleaned up:** never; soft-deleted rows stay. Each row is a few hundred bytes.

### `projects`

- **Holds:** `path`, unique: a folder sessions run in, and `added`: listed in the Sessions view. One list serves every
  window.
- **Written by:** `ProjectService` through the base service. Add Project upserts the row with `added` set, which puts it
  at the end of the list, removed before or not; Remove Project clears `added`. A window's own folder that makes way for
  the shown project is added the same way; a project already added keeps its place, so switching projects never moves
  one. A session in a window's own folder gives that folder a row without `added`, so it stays one of the window's own.
- **Read by:** `ProjectRepository`: the added projects in `sortId` order, at startup, after each write and after another
  window's.

### `sessions`

- **Holds:** `projectId`, `harnessId`, `name` (the agent's latest title, or ours until it gives one) and `customName`
  (the user's, from the row menu's Rename, or NULL). The `id` is also the agent's session id.
- **Written by:** `SessionService` through the base service: a row per New Session, `name` when the agent's title in the
  row changes, `customName` on Rename, and a soft delete on Remove Session. Removing a project keeps its sessions, so
  adding the project again lists them again.
- **Read by:** `SessionRepository`, with its project's path, at startup, after each write, and within 250 ms of another
  connection's write (`aggregor-pty`'s or another window's), which the window sees by polling `PRAGMA data_version`.
- **Status columns:** `status` (`unknown` until a report, `exited` once the agent is gone), `statusKind`,
  `statusMessage`, `statusProgress`, `statusChangedAt` (when the state last changed), `hasWorked` (it has reported
  `working`), `reportedTitle` (the title in its latest OSC 7501 report) and `terminalTitle` (its latest window title).
  Written only by `aggregor-pty` (`apps/pty`), which runs the agent and reads them from its output. The Sessions view
  shows the status, kind, message and progress; the titles become `name`; `hasWorked` picks resume over a fresh start.

### `aggregor-pty.log`

- **Holds:** one line per error `aggregor-pty` hits with the database, such as a locked file or a missing session row,
  with the time and session id; at most 10 lines a run.
- **Written by:** `aggregor-pty`, beside the database, since the agent's terminal is no place for its errors.
- **Cleaned up:** never; it only grows when something is wrong.

## Files under `globalStorageUri`

A folder the extension owns. On Linux it is `~/.config/Code/User/globalStorage/salmanafzal.aggregor-app/`.

### `anchor/`

- **Holds:**
  - `Aggregor/`, the anchor folder: empty but for `.vscode/settings.json`, with `files.exclude` set to `{"**": true}`
    and `terminal.integrated.cwd` set to the shown project. Save Workspace As suggests saving
    `Aggregor/Aggregor.code-workspace`, so a saved workspace usually lives here too.
  - `saveOffered`, an empty file: the window was offered to save its workspace.
- **Written by:** `WorkspaceInfraService`: the settings before every project switch, the marker when it offers; VS Code,
  the workspace file when the user saves it there.
- **Read by:** VS Code, as the window's folder 0, which its own settings hide from Explorer; `WorkspaceInfraService`
  checks the marker.
- **Why:** with the anchor folder at folder 0, the shown project swaps at folder 1; changing folder 0 restarts every
  extension. Its terminal cwd makes New Terminal count it and the project as one folder, so it opens in the project
  without asking. Named `Aggregor`, it names the saved workspace and its row in folder pickers. The marker makes the
  offer once. Aggregor is meant for one window; a second window would share the anchor folder and its settings.
- **Cleaned up:** never; an empty folder, a settings file of a few hundred bytes, an empty marker and maybe a workspace
  file.
