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

### `windows`

- **Holds:** `key`, unique: the window's key from `findWindowKey` (`infrastructure/utils/anchorFolder.utils.ts`): its
  anchor folder's directory name once it has one, else its first folder's name and a hash of its path, which is the name
  its anchor folder's directory gets. A window without folders is `window-` and a hash of its session id; its first Add
  Project gives it an anchor folder at once, which keeps the key.
- **Written by:** `WindowRepository`, which upserts the window's row at startup.
- **Why:** the key stays the same when a single-folder window turns into an untitled multi-root workspace, which VS Code
  starts with an empty `workspaceState`.

### `projects`

- **Holds:** `path`, unique: a folder sessions run in.
- **Written by:** `ProjectService` through `BaseService.upsertEntity`, the first time a path is added to a window or
  given a session; a workspace folder that is never used gets no row.

### `windowProjects`

- **Holds:** `windowId` and `projectId`, unique together: a project added to a window with Add Project, or a folder that
  left the workspace for the shown project.
- **Written by:** `WindowRepository`: Add Project upserts the row, bringing back a soft-deleted one; Remove Project
  soft-deletes it. A window's own folder that makes way for the shown project gets a row; a project that has one keeps
  it as it is, so switching projects never moves one.
- **Read by:** `WindowRepository`, with its project's path, at startup and after each change. The window lists its added
  projects in `sortId` order, so the one added last, again or for the first time, comes last.

### `sessions`

- **Holds:** `projectId`, `harnessId`, `name` (the agent's latest title, or ours until it gives one) and `customName`
  (the user's, from the row menu's Rename, or NULL). The `id` is also the agent's session id.
- **Written by:** `SessionService` through the base service: a row per New Session, `name` when the agent's title
  changes, `customName` on Rename, and a soft delete on Remove Session. Removing a project keeps its sessions, so adding
  the project again lists them again.
- **Read by:** `SessionRepository`, with its project's path, at startup, after each write and when a window regains
  focus.

## Files under `globalStorageUri`

A folder the extension owns. On Linux it is `~/.config/Code/User/globalStorage/salmanafzal.aggregor-app/`.

### `anchors/<window key>/`

- **Holds:**
  - `Aggregor/`, the anchor folder: empty but for `.vscode/settings.json`, with `files.exclude` set to `{"**": true}`
    and `terminal.integrated.cwd` set to the shown project. Save Workspace As suggests saving
    `Aggregor/Aggregor.code-workspace`, so a saved workspace usually lives here too.
  - `saveOffered`, an empty file: the window was offered to save its workspace.
- **Written by:** `WorkspaceInfraService`: the settings before every project switch, the marker when it offers; VS Code,
  the workspace file when the user saves it there.
- **Read by:** VS Code, as that window's folder 0, which its own settings hide from Explorer; `WorkspaceInfraService`
  checks the marker.
- **Why:** with the anchor folder at folder 0, the shown project swaps at folder 1; changing folder 0 restarts every
  extension. Its terminal cwd makes New Terminal count it and the project as one folder, so it opens in the project
  without asking. Named `Aggregor`, it names the saved workspace and its row in folder pickers. The marker makes the
  offer once per window.
- **Cleaned up:** never; each is an empty folder, a settings file of a few hundred bytes, an empty marker and maybe a
  workspace file.

### `status/<session id>`

- **Holds:** one word: `running`, `needs-input`, `idle` or `exited`.
- **Written by:** the Claude Code hooks in [hooks.json](apps/extension/assets/hooks.json). Each session's terminal gets
  the file's path in the `AGGREGOR_STATUS_FILE` env var.
- **Read by:** `ClaudeCodeHarnessInfraService`, which watches the folder and feeds the Sessions tree.
- **Why:** live status. Hooks are shell one-liners, so a plain file is the simplest thing they can write, and every
  window can watch the same folder.
- **Cleaned up:** deleted before each launch and when the session is removed. Removing a running session can leave the
  file behind, because the agent's `SessionEnd` hook may write after the delete. Each leftover is a few bytes.
