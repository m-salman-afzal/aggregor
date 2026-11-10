# Storage

What the extension stores, where, and why. Add an entry whenever something new is stored, and keep every entry to what
is stored now.

Everything but one user setting lives in the Aggregor folder, `~/.aggregor` (or `$AGGREGOR_HOME`), which only its owner
can read. Every window and every VS Code profile shares it, and it survives reloads, restarts and extension updates. The
build F5 runs keeps its own, `~/.aggregorDev`, and `$AGGREGOR_DATABASE_FILE` puts the database elsewhere, with
`aggregor-pty.log` beside it.

## `data/aggregor.db`

A SQLite file, in WAL mode with foreign keys on, so `aggregor.db-wal` and `aggregor.db-shm` sit beside it. Every window
opens it through `@effect/sql-sqlite-node`, with Drizzle's query builder. `infrastructure/database/models/` defines each
table as a Drizzle table, one file per table, and `base.model.ts` the shared columns.

- **Every table** starts with `id` (a UUID v7, which also gives the row's creation time), `sortId` (its place in the
  table's order: a new row, or one upserted again, gets the table's highest plus one, a moved row and the rows after its
  new place get the next ones, and reads follow it), `updatedAt` (set on every write) and `deletedAt` (set by a soft
  delete; reads skip the row). Timestamps are ISO 8601 text in UTC, such as `2026-11-07T22:13:46.836Z`.
- **Migrations:** `apps/extension/assets/migrations/`, written by `pnpm db:generate`: before 0.1.0 one, regenerated from
  zero on each schema change, with the old database deleted. A window applies the ones the database lacks when it
  starts, and Drizzle records each applied one in `__drizzle_migrations`.
- **Read:** on demand: no window keeps a copy. A window hears of each write within 250 ms of another connection's
  (`aggregor-pty`'s or another window's), which it sees by polling `PRAGMA data_version`, and at once after its own; it
  then reads the rows whose `updatedAt` is at or after the last one it read.
- **Cleaned up:** never; soft-deleted rows stay. Each row is a few hundred bytes.

### `projects`

- **Holds:** `path`, unique: a folder sessions run in, and `isAdded`: listed in the Sessions view. One list serves every
  window.
- **Written by:** `ProjectService` through the base service. Add Project upserts the row with `isAdded` set, which puts
  it at the end of the list, removed before or not; Remove Project clears `isAdded`. A window's own folder that makes
  way for the shown project is added the same way; a project already added keeps its place, so switching projects never
  moves one. A session in a window's own folder gives that folder a row without `isAdded`, so it stays one of the
  window's own. Move Up, Move Down and a drop on another added project rewrite `sortId`.
- **Read by:** `ProjectService`: the added projects in `sortId` order, for the Sessions view and the project pickers.

### `sessions`

- **Holds:** `projectId`, `agentId` (its `aggregorApp.agents` key), `name` (the agent's latest title, or ours until it
  gives one), `customName` (the user's, from the row menu's Rename, or NULL) and `viewedAt` (when the session last came
  into or left the user's view). The `id` is also the agent's session id.
- **Written by:** `SessionService` through the base service: a row per New Session, `name` when the agent's title in the
  row changes, `customName` on Rename, `viewedAt` as the session comes into and leaves view, `sortId` on Move Up, Move
  Down and a drop on another of its project's sessions, and a soft delete on Remove Session. Removing a project keeps
  its sessions, so adding the project again lists them again.
- **Read by:** `SessionService`, with the project's path: the Sessions view reads each row as it draws it.
- **Status columns:** `status` (`unknown` until a report, `exited` once the agent is gone), `statusKind`,
  `statusMessage`, `statusProgress`, `statusChangedAt` (when the state last changed), `hasWorked` (it has reported
  `working`), `reportedTitle` (the title in its latest OSC 7501 report), `terminalTitle` (its latest window title) and
  `agentSessionId` (the latest window title that was a bare UUID: Codex's own id for its conversation). Written only by
  `aggregor-pty` (`apps/pty`), which runs the agent and reads them from its output. The Sessions view shows the status,
  kind, message and progress, and shows `done` as finished only while the turn ended after `viewedAt` and the session is
  out of view; the titles become `name`. `SessionService` reads `hasWorked` and `agentSessionId` when it opens a tab, so
  an agent started again resumes its conversation rather than starting a new one.

## `data/aggregor-pty.log`

- **Holds:** one line per error `aggregor-pty` hits with the database, such as a locked file or a missing session row,
  with the time and session id; at most 10 lines a run.
- **Written by:** `aggregor-pty`, beside the database, since the agent's terminal is no place for its errors.
- **Cleaned up:** never; it only grows when something is wrong.

## `tmux.sock`

- **Holds:** the socket of Aggregor's own tmux server (`tmux -S`), which runs one tmux session per running agent, named
  by the session's id. tmux creates it, readable only by its owner.
- **Written by:** tmux, when a session tab starts the first agent; the server stops with its last session.
- **Read by:** each session tab's `tmux new-session -A`, which starts or attaches to its tmux session, and
  `TmuxInfraService`, to list and stop sessions.
- **Why:** an agent outlives its tab, a reload and VS Code, and the server stays apart from the user's own tmux. In the
  Aggregor folder, a test's `AGGREGOR_HOME` gets a server of its own.
- **Cleaned up:** by tmux; a stale socket left by a reboot is replaced when the next server starts.

## `anchor/`

- **Holds:**
  - `Aggregor/`, the anchor folder: empty but for `.vscode/settings.json`, with `files.exclude` set to `{"**": true}`
    and `terminal.integrated.cwd` set to the shown project.
  - `Aggregor.code-workspace`, Aggregor's workspace: the anchor folder, then the shown project, and as its `settings`
    the shown project's `.vscode/settings.json`, synced both ways, with relative paths and folder variables naming the
    project.
  - `copiedProjectSettings.json`: the settings last copied into the workspace file and the project they came from, which
    each sync compares both sides with.
  - `sessionToReopen.json`: the session the window was switching to when it reloaded to open the workspace, with when.
- **Written by:** `WorkspaceInfraService`: the settings before every project switch, the workspace file and the session
  to reopen on the first switch, and the workspace file's `settings` and the last copy on each settings sync, through VS
  Code's own copy of the workspace file; VS Code, the workspace file's folders on later switches, and any setting it or
  an extension writes at the workspace level.
- **Read by:** VS Code, the workspace file as the window's workspace and the anchor folder as its folder 0, which its
  own settings hide from Explorer; `WorkspaceInfraService`, the session to reopen when the window starts, and the
  workspace file's `settings` and the last copy on each settings sync.
- **Also written:** the shown project's own `.vscode/settings.json`, by `WorkspaceInfraService`, with each setting VS
  Code or an extension changed in the workspace file, as VS Code writes it there with the project open alone.
- **Why:** with the anchor folder at folder 0, the shown project swaps at folder 1; changing folder 0 restarts every
  extension. Its terminal cwd makes New Terminal count it and the project as one folder, so it opens in the project
  without asking. The workspace file names the window Aggregor and is never offered to be saved. It sits a level below
  the Aggregor folder, so the window never watches the database. Aggregor is meant for one window; a second window, in
  any profile, would share the anchor folder and its settings.
- **Cleaned up:** the session to reopen when the reloaded window reads it, or when one older than a minute is found; the
  rest never: an empty folder, a settings file of a few hundred bytes, a workspace file and the last copy. A
  `saveOffered` marker left from before 2026-11-10 is no longer read.

## User settings

- **Holds:** `aggregorApp.defaultAgent`, the agent New Session offers first.
- **Written by:** `SettingsConfig.saveDefaultAgentId`, when the user clicks an agent's **Set as Default** in the picker,
  into the user's `settings.json`.
- **Read by:** `SessionService`, through `ISettingsConfig.readSessionSettings`, each time New Session runs.
- **Cleaned up:** by the user, like any setting.
