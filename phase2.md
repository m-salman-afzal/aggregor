# Phase 2: agent foundation

The plan for the `harness-foundation` stack, written to be read one step at a time. Each step is one PR on
`stack/harness-foundation/<n>/<type>/<slug>`, stacked on the step before it. **Agreed** and each step's **Decided** are
settled. Each step's **To decide** is still open, with a recommendation. Every step's list is posted again for approval
before its code, as `AGENTS.md` asks, and moves into `decisions.md` with the code.

## Where this ends up

- Agents are settings, not code: Claude Code, Codex, Antigravity, OpenCode and GitHub Copilot ship as built-ins, and any
  other CLI is one more settings entry.
- Status comes from the agent itself, through OSC 7501, read by a small Rust binary (`aggregor-pty`) that runs each
  agent. Hooks, transcript lookups and title guessing go away.
- Every session runs in tmux, so closing a tab or reloading VS Code never kills an agent.
- Projects, sessions and live status live in related SQLite tables at `~/.aggregor/aggregor.db`, outside VS Code's
  storage, behind a base entity, a base repository and a base service. One project list serves every window; Aggregor is
  meant for one window.
- A session that changes state while you aren't looking at it raises a notification: inside VS Code, or from the OS when
  VS Code isn't focused.
- A session row lists what runs inside it, such as Claude's subagents, each with its own status.

## What the agents do today

Tested on 2026-11-07 in `~/side/jsTester`, each agent under tmux 3.7c and a Python stand-in for `aggregor-pty` that
answers the OSC 7501 check in the stream and logs every report and title. Claude's question and permission prompts were
tested earlier the same day under a plain pty.

|                       | claude 2.1.319                                   | codex 0.163.0                                        | agy 1.5.2                                                       | opencode 2.2.5                                           | copilot 1.0.105                                  |
| --------------------- | ------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Sends the 7501 check  | yes                                              | no, but reports anyway                               | yes                                                             | yes                                                      | no                                               |
| States seen           | idle, working, done, blocked                     | idle, working                                        | idle, working, done, blocked                                    | idle, working                                            | none                                             |
| Blocked reports       | permission (`approve Write: …`), question        | not seen: it ran the test command without asking     | auth (`Sign in required`), permission (`Approve RunCommand: …`) | not seen: it ran the test command without asking         | none                                             |
| After a turn          | done                                             | idle                                                 | done (msg is the answer)                                        | idle                                                     | nothing                                          |
| Interrupted (Esc)     | idle                                             | idle                                                 | idle                                                            | needs Esc twice; idle not confirmed                      | needs Esc twice                                  |
| On `/exit`            | clear                                            | clear                                                | idle                                                            | nothing                                                  | nothing                                          |
| Terminal title        | the conversation title; `Claude Code` before one | `‹title› \| ‹folder›`; `⠋ \| ‹folder›` while working | none                                                            | `OC \| ‹title›`; its 7501 reports carry `title=‹title›`  | `‹title› - GitHub Copilot`                       |
| Takes our id at start | `--session-id ‹uuid›`                            | no flag for it                                       | no flag for it                                                  | `--session ses_‹uuid›` (seen in `opencode session list`) | `--session-id ‹uuid›` (seen in its exit message) |
| Resumes with          | `--resume ‹id›`                                  | `resume ‹id›`, or `resume` for its picker            | `--conversation=‹id›`, or `-c` for the most recent              | `--session ‹id›`                                         | `--session-id ‹id›` or `--resume=‹id›`           |

Other things the tests showed:

- Under tmux, the stand-in's answer reached Claude before tmux's reply to Claude's follow-up DA1 query, so Claude
  reported normally. The in-stream binary inside tmux works.
- Claude reports each running subagent as its own record: two parallel subagents showed up as
  `id=a01875c195e92b1d9 title=Compute 2+2` and `id=ab3aedbcaa74e3466 title=Compute 3+3`, both `working`, each cleared
  when it finished.
- Claude asks for tmux's `focus-events on` in its footer when it is off.
- Antigravity reported `blocked kind=auth` for about 2 seconds at startup while it loaded its login, then moved on.
- OpenCode also reports a second record, `id=ses_…` with the conversation title, and clears it after each turn.
- OpenCode's free messages ran out during the tests (they reset at 05:00 on 2026-11-08), so its turns are not retested
  yet.
- Codex's `tui.terminal_title` setting can show only the thread title (`-c 'tui.terminal_title=["thread-title"]'`); it
  then shows the thread id, with a spinner, until the title exists.
- Under `aggregor-pty` on 2026-11-08, Codex 0.167.0 reported `done` after a turn, not `idle`, and `working` for a moment
  at startup.
- crush, goose, pi and grok are also installed; crush and goose report OSC 7501 per areweosc7501yet.com. Each would be
  one settings entry.

## Agreed

### Agents as settings

1. **Agents are data.** `ClaudeCodeAgentInfraService`, `IAgentInfraService(s)`, the `LayerMap` and `agent.utils.ts` go.
   An agent is a domain entity read from settings (a value object until step 4), a domain function builds its launch
   command, and the agent id is its settings key.
2. **`aggregorApp.agents`**, keyed by command name: `{name, command, args, resumeArgs, icon}`. `command` defaults to the
   key. The built-ins merge with the user's entries, and `null` hides one. `machine` scope, so only user settings can
   define commands. No `env` field; `${sessionId}` is the only variable. Edited in settings.json.
3. **Built-ins:** `claude`, `codex`, `agy` (Antigravity, replacing Gemini CLI, which is deprecated), `opencode`,
   `copilot`. Their entries are under step 4.
4. **Resume:** `resumeArgs` once the session has reported `working` at least once; `args` before that. With tmux this
   only matters once the tmux session is gone, such as after a reboot or an agent exit.
5. **Icons:** a codicon id or an image path, relative paths inside the extension. Official logos in `assets/agents/`,
   renamed from `assets/models/`; Copilot's is the `copilot` codicon.
6. **Picker:** "New Session" (was "New Claude Session") lists the agents whose command is on PATH; with one there is no
   picker. The default comes first, preselected, and each item has a "Set as default" button. `aggregorApp.defaultAgent`
   (default `claude`) and `aggregorApp.skipAgentPicker` (default false).

### Status

7. **Status and titles come from the agent's output:** OSC 7501 for status, OSC 7501 `title` or OSC 0/2 for titles, read
   by `aggregor-pty`. The hooks, `AGGREGOR_STATUS_FILE`, status files, transcript lookup, the interrupt settle (#71),
   `idleTitleMark` and `Terminal.name` polling go. A renamed session keeps getting status and titles.
8. **Statuses are the spec's:** idle, working, done, blocked (kind permission, question or auth, with a message) and
   error, plus `exited` (the agent or its tmux session is gone) and `unknown` (no report yet, or cleared). They live on
   the session's own row. The message shows in the tooltip and notifications; progress shows as `42%` on the row. The
   root record is the session's status; records with an `id` are the session's tasks, under step 8. The binary enforces
   the spec's limits.
9. **Done means not seen yet.** A turn that ends while its session is out of view shows as done until the session comes
   into view. Since step 3's review the database stores it: `viewedAt` against `statusChangedAt`, so it covers agents
   that report `done` (Claude, Antigravity, Codex 0.167) and not those that go straight back to `idle` (OpenCode 2.2.5).

### Alerts

10. **State changes of a session out of view notify:** inside VS Code in the focused window, whichever workspace it
    shows, and through the OS when no VS Code window is focused. The Sessions view badge counts sessions blocked,
    errored, or finished and unseen. Which states, and how, under step 6.

### Runtime

11. **`aggregor-pty`**, Rust, in `apps/pty`: portable-pty runs the agent, rusqlite (bundled SQLite) writes its status,
    and a small hand-written OSC scanner with tests reads the stream. It answers the 7501 check in the stream, passes
    every byte through, forwards resizes and records the exit. One per session, inside its tmux session.
12. **Packaging:** a VSIX per platform (linux x64 and arm64 as static binaries, darwin x64 and arm64), built in CI, plus
    a universal one without the binary. Windows through WSL now; native Windows through psmux later.
13. **tmux 3.2 or newer is required**, with its own server (`-L aggregor`) and its own config shipped in the extension.
14. **tmux check and one-click install** before a session starts or opens; under step 5.
15. **Lifecycle:** a session's terminal runs
    `tmux -L aggregor new-session -A -s ‹sessionId› -c ‹project› -- aggregor-pty … -- ‹agent›`, for new and reopened
    sessions alike. Closing the tab detaches; Remove Session kills the tmux session; an agent exit marks the session
    exited, and opening it again resumes.

### Storage

16. **SQLite at `~/.aggregor/aggregor.db`** (`~/.aggregor/data/aggregor.db` since step 3's review, the Aggregor folder
    moved by `AGGREGOR_HOME`), overridden by `AGGREGOR_DATA_DIR` for tests, in WAL mode, with related tables that share
    `id` (a UUID v7), `sortId`, `updatedAt` and `deletedAt`, camelCase names, and a base entity, base repository and
    base service; under step 1. The extension uses `@effect/sql-sqlite-node` 4.1.2 (Effect's client on Node's built-in
    `node:sqlite`, so no native module), with Drizzle's tables, query builder and generated migrations on top; the
    binary uses rusqlite. Today's `globalState` data is not imported. The anchor folders stay in VS Code's global
    storage.
17. **A socket later**, once the extension needs to talk to a running binary: one per session, through the interprocess
    crate.

### Process

18. `decisions.md`, the `AGENTS.md` paragraph and this file land in step 0. Each later step adds or rewrites its own
    `decisions.md` entries and updates `README.md`, `DDD.md` and the storage ledger.
19. Each step gets its decision list approved before its code, a check in the headless VS Code, and a commit only on the
    user's OK.

## Step 0: decisions ledger

**Branch:** `stack/harness-foundation/0/chore/decisions-ledger`

- `decisions.md`: every decision so far, with its problem, options and reasons.
- `AGENTS.md`: the paragraph that makes `decisions.md` part of every change.
- `phase2.md`: this plan, linked from the roadmap in `README.md`.

**Verify:** `pnpm format:check` and the pre-commit hook.

## Step 1: SQLite storage

**Branch:** `stack/harness-foundation/1/feat/sqlite-storage`

Projects and sessions move out of `globalState` into related tables in `~/.aggregor/aggregor.db`, behind a base entity,
a base repository and a base service. The added projects become one list for every window.

**Tables.** Every table starts with the same four columns, and every name is camelCase:

| Column      | Type               | Meaning                                                                                            |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `id`        | `TEXT PRIMARY KEY` | a UUID v7: unique, sorted by creation time and carrying that time, so no `uuid` or `createdAt` too |
| `sortId`    | `INTEGER NOT NULL` | the row's place in its table's order: a new row gets the highest plus one; moving a row changes it |
| `updatedAt` | `TEXT NOT NULL`    | ISO 8601 in UTC (`2026-11-07T22:13:46.836Z`), set on every write                                   |
| `deletedAt` | `TEXT`             | set by a soft delete, in the same format; reads skip the row                                       |

| Table      | Its own columns                                        | Relations                                              |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------ |
| `projects` | `path` (unique), `added` (listed in the Sessions view) | has many sessions                                      |
| `sessions` | `projectId`, `agentId`, `name`, `customName` (null)    | belongs to one project; step 2 adds its status columns |

- Relations point at `id` with `REFERENCES`, and `PRAGMA foreign_keys = ON` checks them.
- Add Project upserts the project's row with `added`, which puts it at the end of the list. A session in a workspace
  folder gives that folder's project a row without `added`, so it stays one of the window's own folders.
- Remove Project clears `added`. The project and its sessions stay, so adding it again lists them again, as today, and
  puts it at the end of the list. Remove Session soft-deletes the session.
- WAL and a busy timeout on every connection. `drizzle-kit generate` writes a migration for each schema change, and a
  window applies the ones the database lacks when it starts, in one write transaction.

**Base pieces:**

- **`EntityIdValueObject`** (domain): the branded UUID v7 that every entity's `id` is; it replaces
  `SessionIdValueObject`. Its factory service, `entityId.domainService.ts`, gives what the three old columns did:
  `makeEntityId` (on Effect's `SecureRandom.uuidV7`), `getEntityIdCreatedAt`, and order, since ids sort by creation time
  as text.
- **`BaseEntity`** (domain): a `Schema.Class` with `id`, `sortId`, `updatedAt` and `deletedAt`, timestamps as
  `DateTime.Utc`; every entity extends it and knows nothing of how it is stored. Its factory, `fromRow`, turns NULL into
  an absent field and the ISO text of `updatedAt` and `deletedAt` into a `DateTime`, then decodes the row into the
  entity.
- **`IBaseRepository<Entity, AddRequest>`** (domain): `add`, `findById`, `findMany`, `update`, `upsert` and
  `softDelete`. `ISessionRepository` and `IProjectRepository` extend it.
- **`makeBaseRepository`** (infrastructure), on Drizzle's query builder, given an entity, its table model and a join for
  columns it reads from another table:
  - reads skip soft-deleted rows, list rows in `sortId` order, and go through `BaseEntity.fromRow`, so services only
    ever receive entities;
  - `add` and `upsert` put the row last; `upsert` updates the row with the same unique columns instead, bringing back a
    soft-deleted one;
  - `update` writes only the columns it is given, plus `updatedAt`, so the extension and `aggregor-pty` never overwrite
    each other's columns.
- **`BaseService`** (application): `base.service.ts`, the same six calls for any entity's repository. The session,
  project and workspace services build on it instead of calling their repositories, and it holds the one mapping from
  repository errors to messages.
- Effect's `Model.Class` was tried for the entities and reverted: the domain entity would know how it is stored.
  Effect's `SqlModel.makeRepository` was weighed: its reads are `select *`, so no joined columns; its update writes the
  whole row outside a transaction; its soft delete writes `CURRENT_TIMESTAMP`, which isn't ISO text. A `Model.Class`
  can't create tables either, and Effect's `Migrator` runs hand-written migrations.
- **Table models** (`infrastructure/database/models/`): one Drizzle `sqliteTable` per file, spreading `BASE_COLUMNS`
  from `base.model.ts`. `drizzle-kit generate` (`apps/extension/drizzle.config.ts`) writes the migrations into
  `apps/extension/assets/migrations/`, which ship in the VSIX; the database layer runs Drizzle's `migrate`.

**Other changes:**

- Add `@effect/sql-sqlite-node` 4.1.2, `drizzle-orm` 1.0.0-rc.5 and, for development, `drizzle-kit` 1.0.0-rc.5.
  `node:sqlite` works in VS Code 1.145's Electron (Node 24.22, SQLite 3.53.4), and `vite.config.ts` already keeps every
  `node:` import external. Drizzle supports Effect 4 itself, on the same `@effect/sql-sqlite-node` client.
- A database layer opens the file, creating `~/.aggregor` with mode 0700, and applies the migrations.
- `ProjectEntity` becomes the stored project. The tree's project rows become `ListedProjectValueObject` (path, name,
  added), since a workspace folder is listed before its project has a row.
- `SessionEntity` gains `projectId`; `projectPath` comes from its project through a join. `withName` and
  `withCustomName` go: services pass `update` the columns that change.
- `SessionRepository` and `ProjectRepository` build on the base repository instead of read-modify-writing `globalState`;
  `modifySessions` and `modifyAddedProjectPaths` go. The window key (`findWindowKey`) goes, and the anchor folder
  becomes one: `globalStorage/anchor/Aggregor`.
- `StoredSessionsModel` and `StoredAddedProjectPathsModel`, with their `version` fields, go; `database/models/` holds
  the table models.
- `globalstorage.md` becomes `storage.md`, covers the database too, and lists only what is stored now.

**Decided:**

1. The file lives at `~/.aggregor/aggregor.db`; windows keep re-reading on focus until step 3 watches the database; the
   generic `update` replaces the read-modify-write; today's data is not imported.
2. The entity factory, `BaseEntity.fromRow`, runs inside the base repository on every row it returns; entities don't
   know how they're stored.
3. A `BaseService` now, as the foundation the entity services build on.
4. One id per row: a UUID v7 value object replaces `id`, `uuid` and `createdAt`. A session's id is also the id its agent
   gets (`--session-id`; Claude Code accepts a UUID v7, checked on 2026-11-07), so `SessionIdValueObject` folds into
   `EntityIdValueObject` and no `sessionUuid` rename is needed.
5. Relations point at that id, which also keeps ids unique across machines if databases are ever merged.
6. Timestamps are ISO 8601 text in UTC, such as `2026-11-07T22:13:46.836Z`, readable in `sqlite3`; entities still hold
   `DateTime.Utc`, parsed in `fromRow`.
7. A project added again, removed or not, moves to the end of the list. Switching projects never moves one.
8. Every row has a `sortId`, the table's highest plus one when added or upserted, which reads follow; moving projects
   and sessions up and down will change it. SQLite's `AUTOINCREMENT` needs an integer primary key, so the base
   repository sets it in the statement that writes the row.
9. Drizzle on Effect (`drizzle-orm/effect-sqlite-node`, 1.0.0-rc.5, pinned) defines the tables, builds the queries and
   generates the migrations, one per schema change, even before 0.1.0. It replaces the hand-written `CREATE TABLE`s and
   the `PRAGMA user_version` rebuild.
10. One project list for every window (2026-11-08): Aggregor is meant for one window. Until step 5, a second window
    shows the same sessions, and opening a running one there would start a second agent on its id.

**Verify:** add and remove projects; start, rename and remove sessions; reload; then read the rows with `sqlite3` and
check the relations, the soft deletes, the timestamps, and that ids sort in creation order.

## Step 2: the `aggregor-pty` binary

**Branch:** `stack/harness-foundation/2/feat/pty-binary`

The binary is built, tested and packaged; the extension starts running agents through it in step 3.

**Changes:**

- `apps/pty`: a Rust crate (edition 2024, toolchain pinned to 1.99.1 in `rust-toolchain.toml`) building `aggregor-pty`,
  with portable-pty 0.9, rusqlite 0.41 (bundled SQLite), base64 0.23, rustix (raw mode, window size) and signal-hook
  (resizes, hangups).
- Usage: `aggregor-pty --database ‹path› --session ‹sessionId› -- ‹command› ‹args›…`.
- What it does:
  - puts its own terminal in raw mode and starts the agent in a pty of the same size, in the current directory;
  - copies input to the agent and the agent's output out, byte for byte;
  - scans the output for OSC 7501 and OSC 0/2, across read boundaries, ending in BEL or ST, and drops a sequence over
    the spec's 4096 bytes;
  - answers `OSC 7501 ; ?` at once;
  - validates reports per the spec's rules and limits, and writes the root record and the window title onto the
    session's row;
  - forwards window resizes, and passes a hangup or termination on to the agent;
  - when the agent exits, writes `exited` and exits with the agent's code.
- The `sessions` table gains `status` (default `unknown`), `statusKind`, `statusMessage`, `statusProgress`,
  `statusChangedAt`, `hasWorked` (default false), `reportedTitle` (the root record's 7501 `title`) and `terminalTitle`
  (the latest OSC 0/2 title), with a generated migration. Only the binary writes them, one `UPDATE` by `id` that skips
  soft-deleted rows and sets `updatedAt`, with timestamps from SQLite's `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`.
- What it writes:
  - at start: `unknown`, with kind, message, progress and the reported title cleared, and `statusChangedAt`;
  - a root report: state, kind, message, progress and title, replaced together as the spec's records are;
    `statusChangedAt` only when the state changes; `hasWorked` from the first `working` on;
  - `clear` with no id, or a full reset (RIS): `unknown`;
  - reports with an `id`: validated and ignored until step 8;
  - on exit: `exited`, keeping the titles.
- A writer thread takes the latest pending change, so a busy database never holds up the agent's output. State changes
  are written at once, title changes at most every 500 ms.
- The agent runs whatever happens to the database, and nothing is printed to its terminal. Errors go to
  `aggregor-pty.log` beside the database, at most 10 lines a run.
- Rust tests: the scanner (split sequences, both terminators, oversize, abandoned sequences, titles, RIS) and the report
  parser (states, kinds, progress, ids, base64, control characters, limits), plus one end-to-end run of a `bash` script
  under the binary against a database built from the extension's own migrations.
- `apps/pty` is a pnpm workspace package: `pnpm pty:check` (`cargo fmt --check` and `cargo clippy -D warnings`, part of
  `pnpm quality`) and `pnpm pty:test`; the pre-commit hook runs `rustfmt --check` on staged `.rs` files; `rustfmt.toml`
  matches Prettier's 120 columns.
- The extension's `build:pty` builds the binary for the host into `apps/extension/bin/` (ignored by git); `compile`,
  `package` and the `verify-in-vscode` skill run it.
- CI: Checks adds `pty:check` and `pty:test`, and packages the VSIX with the runner's binary. Release builds the Linux
  musl binaries with cargo-zigbuild (0.24.1, Zig 0.17.1, in a venv) on a Linux runner and both macOS targets on one
  macOS runner, then packages `linux-x64`, `linux-arm64`, `darwin-x64` and `darwin-arm64` VSIXs and a universal one
  without the binary, and publishes them together.

**Decided:**

1. Linux binaries are built with `cargo-zigbuild` on one Linux runner, for both musl targets.
2. A universal VSIX without the binary is published too. Its message, reopen in WSL (Windows) or unsupported platform,
   comes in step 3, when the extension first needs the binary.
3. The reply to the check is the bare `OSC 7501 ; ? ST`.
4. portable-pty, though its last release is from February 2025, since it also covers native Windows later.
5. Two title columns instead of one `agentTitle`: which title wins is step 4's rule, which belongs in the domain.
6. The extension's migrations build the end-to-end test's database, so the binary is tested against the real schema.

**Verified (2026-11-08):** the Rust tests; Claude, Codex and Antigravity under the built binary inside tmux in
`~/side/jsTester`. Claude: idle, working, done; `blocked question` with its message; Esc to idle; `/exit` to unknown,
then exited. Codex 0.167.0: working for a moment at startup, then working and done for a turn. Antigravity:
`blocked auth` for 2 seconds at start, `blocked permission` (`Approve RunCommand: echo hi`), done. Resizes reach the
agent; a killed tmux session leaves `exited`. Both musl binaries build with cargo-zigbuild, and the linux-x64 VSIX
installs with the binary still executable.

## Step 3: status from OSC 7501

**Branch:** `stack/harness-foundation/3/feat/status-from-osc-7501`

Session terminals start the agent through `aggregor-pty` (no tmux yet), and status and titles come from the session's
row.

**Changes:**

- A session's terminal runs `‹extension›/bin/aggregor-pty --database ‹path› --session ‹sessionId› -- ‹agent command›`:
  the terminal infra service wraps the agent's launch plan, and `getDatabaseFilePath` gives it and the database layer
  the same path.
- `StatusValueObject` is the spec's states plus `unknown` and `exited`, and `StatusKindValueObject` permission, question
  or auth. `SessionEntity` gains `status`, `statusKind`, `statusMessage`, `statusProgress`, `hasWorked`, `reportedTitle`
  and `terminalTitle`, read through `SessionRepository` like the rest of the session.
- `refreshOnDatabaseChanges` polls `PRAGMA data_version` every 250 ms, and sessions and added projects are re-read when
  another connection has written; the re-read on window focus is gone.
- `startSessionTitleSync` follows the sessions instead of `Terminal.name`. `getSessionTitle` prefers `reportedTitle`,
  else `terminalTitle`, trims status marks at both ends, and ignores an empty title, a placeholder or an id.
- Rows: a badge per state, a blocked session's kind in its label, the agent's message in the tooltip, progress in the
  description, and the unread rule (Agreed 9) on the new states.
- Resume uses `hasWorked` instead of looking for Claude's transcript.
- Without `aggregor-pty`, starting or reopening a session shows why: reopen in WSL on Windows, unsupported elsewhere.
- Deleted: `assets/hooks.json`, `HOOKS_FILE`, `STATUS_ENV`, `INTERRUPTED_TURN_GRACE`, `status.service.ts`, Claude's
  `status.utils.ts`, `transcript.utils.ts`, `claudeCode.transformer.ts` and `claudeCodeAgent.infraService.type.ts`,
  `idleTitleMark`, `clearSessionStatus`, `settleSessionTurn`, `sessionStatuses`, `forEachAgentInfraService`,
  `watchSessionTerminalTitles`, `sessionTerminalTitles` and the launch plan's environment variables.
- Claude's agent service is its launch plan, icon and placeholder titles until step 4 removes it.

**Decided:**

1. Row badges: working keeps the blue spinner; blocked a yellow `●`; done a green `✓`; error a red `✕`; exited a grey
   `○`; idle none. Planned as codicons, but a badge takes only text (codicon badges are a proposed API), and as the
   row's icon they would replace the agent's logo.
2. A session that is `unknown` while its process runs (Copilot) shows as idle with no turn tracking, so it never looks
   stuck; `unknown` has no badge of its own.
3. Windows notice outside writes by polling `PRAGMA data_version` every 250 ms, instead of watching the WAL file, which
   a checkpoint recreates and which doesn't exist before the first write.
4. The terminal infra service wraps the launch plan in `aggregor-pty`; one function gives it and the database layer the
   database path.
5. Without the binary (the universal VSIX), starting or reopening a session shows an error instead.
6. The domain half of step 4's title rule lands here: prefer the 7501 `title`, else the OSC title with status marks
   trimmed at both ends; ignore an empty title, Claude's placeholders, or one that is only an id. Dropping the agent's
   own name waits for step 4.
7. With no terminal in this window, a row shows exited, which covers an agent that died without writing `exited`; with
   one, `unknown` shows as idle. Step 5 replaces the terminal with the tmux session.
8. The unread rule: a session out of view that goes from working or blocked to done or idle shows done until it comes
   into view. `blocked` and `error` always show as themselves.

**Verified (2026-11-08):** in the headless VS Code with Claude in `~/side/jsTester` and a scratch `AGGREGOR_DATA_DIR`:
idle at start, working with the spinner while the name followed Claude's title, done after a turn that ended out of
view; a question showed `has a question` with its message in the tooltip; Esc on the question, and Esc or Ctrl+C mid
turn, went idle; a renamed session kept updating; `/exit` showed exited and closed the tab, and clicking the row resumed
with `claude --resume ‹id›`; a project another connection added showed within a second; with the binary missing, New
Session showed the unsupported-platform message and left no row. Not seen: a done row turning idle once viewed, since
the headless window loses native focus when Claude starts; that path is the unread code from before.

**After review (2026-11-08 and 2026-11-09), on the same branch: the backend drives the Sessions view.**

- Presentation talks to the use cases in DTOs (`application/dtos/`): a controller decodes its input into the use case's
  request DTO and calls one service; services return response DTOs (`SessionListItemDto`, `ProjectListItemDto`) and the
  change notifications (`SessionListChangeDto`: `ProjectListChanged`, `ProjectSessionsChanged`, `SessionChanged`), and
  the view redraws only what changed. Presentation imports nothing from the domain or infrastructure, and lint checks
  each part.
- The tree's nodes are ids, `project:<path>` and `session:<id>`; row menus pass them, and controllers decode them.
- A command's failures come back as typed errors; a presenter per feature turns them into messages, and
  `registerCommand` shows them. Background work logs its failures.
- No copies: the repositories' `sessions` and `addedProjectPaths` are gone, every read is a query, and each repository's
  `entityChanges` reads the rows written since its last check, on a `data_version` change or right after its own write
  (`refreshOnDatabaseChanges` is gone).
- Unread is stored: `viewedAt`, stamped as a session comes into and leaves view, replaces the in-memory set and
  `getUnreadSessionIds`. `StatusValueObject` is `AgentStatusValueObject`; the status the user sees is
  `SessionStatusValueObject`, picked from it; `RowStatus` is gone.
- `VsCodeApi`, the vscode helpers and argument decoding moved to `@pkg/vscode`; the constants split into one file per
  feature; Source Control progress moved into `CommitMessageService` behind `IProgressInfraService`; `projects.added` is
  `isAdded`; files have no length limit.
- The Aggregor folder: `~/.aggregor/data/` holds the database and `aggregor-pty.log`, `~/.aggregor/anchor/` the anchor
  folder and its save-offer marker (out of VS Code's global storage); `AGGREGOR_HOME` replaces `AGGREGOR_DATA_DIR`.
- The migrations became one, regenerated from zero; the old database has to be deleted.
- `build:pty` copies the binary with `cp -f`, so it replaces one that running sessions hold open.

Decided 3 and 8 above change with it: windows read only the changed rows, and done shows until the turn's
`statusChangedAt` is before `viewedAt` or the session is in view.

**Verified after review (2026-11-08):** in the headless VS Code with Claude in `~/side/jsTester` and a fresh
`AGGREGOR_DATA_DIR`: New Session from the project row and the title bar; idle, then working with the spinner stepping,
then finished out of view while the name followed Claude's title; a `viewedAt` written by another connection turned the
row idle within a second; a finished turn stayed finished across Developer: Restart Extension Host with the session out
of view, and turned idle when its tab came back into view; a project another connection added showed within a second,
and Remove Project took it off; Rename passed the session's id and renamed the row and tab; closing the tab showed
exited, and Remove Session took the row off; clicking an exited row resumed the conversation; no warnings or errors in
the trace log. A window reload ends the agents (their tabs are transient), so they show exited after it.

## Step 4: agents from settings, and the picker

**Branch:** `stack/harness-foundation/4/feat/harness-settings-and-picker` (step 5, the picker, folded in)

**Changes:**

- `aggregorApp.agents` (`machine` scope, the built-ins below as its default), `aggregorApp.defaultAgent` (default
  `claude`) and `aggregorApp.skipAgentPicker` (default false) in `package.json`.
- Domain: `AgentEntity` (identified by its settings key, not a `BaseEntity`) behind `IAgentRepository`;
  `AgentIdValueObject` is any settings key; `AgentIconValueObject` is a codicon or an image file;
  `prepareLaunchPlan(agent, session)` returns a `LaunchPlanValueObject`, with `${sessionId}` filled in.
- `AgentRepository` decodes the setting, every field optional (`command` and `name` default to the key, `args` to none,
  `resumeArgs` to `args`, `icon` to `terminal`), at start and on each change of it; an invalid entry is left out with a
  warning naming its key.
- The terminal infra service wraps the plan in `aggregor-pty` and gives the tab the agent's icon and the session's name,
  which `startSessionTabNameSync` keeps equal to the row's: the active tab is renamed at once, a background one when it
  next comes to the front.
- The Sessions view keeps the row of the session in front selected, a new session's included, whatever else is clicked
  in the view.
- A gear, **Open Settings**, in the Sessions title bar opens the Settings editor at Aggregor's settings.
- "New Claude Session" is "New Session"; "New Session..." asks for the project, then the agent. The picker lists the
  agents on `PATH` (`IShellCommandInfraService`, plus `PATHEXT` on Windows), searched each time it opens: icon, name,
  the command as the description, the default first, and a **Set as Default** button that writes
  `aggregorApp.defaultAgent` to user settings and reorders the list.
- One agent installed, or `skipAgentPicker` with the default installed, starts it straight away; none installed fails
  with an error naming the commands searched for, with **Open Settings**. A presenter can name the setting to open, and
  the middleware adds the button.
- A session whose agent is gone shows a warning icon; opening it fails with `AgentNotFoundError`, with **Open
  Settings**.
- Deleted: `services/claudeCodeAgent/`, `agent.infraService.interface.ts`, `agentInfraServices.layer.ts`,
  `agent.utils.ts` (and the `@appUtils` alias with it), `MODEL_ICONS`.
- `assets/models/` is `assets/agents/`: Claude Code's logo, OpenCode's from simple-icons 16.30.0, and Codex's and
  Antigravity's app icons from lobe-icons 1.102.0.

**Built-ins:**

| Key        | Name           | `args`                       | `resumeArgs`                 | Icon              |
| ---------- | -------------- | ---------------------------- | ---------------------------- | ----------------- |
| `claude`   | Claude Code    | `--session-id ${sessionId}`  | `--resume ${sessionId}`      | its logo          |
| `codex`    | Codex          | none                         | `resume` (its picker)        | its app icon      |
| `agy`      | Antigravity    | none                         | `-c` (most recent)           | its app icon      |
| `opencode` | OpenCode       | `--session ses_${sessionId}` | `--session ses_${sessionId}` | its logo          |
| `copilot`  | GitHub Copilot | `--session-id ${sessionId}`  | `--session-id ${sessionId}`  | codicon `copilot` |

**Decided:**

1. An agent is an entity, `AgentEntity`, read through `IAgentRepository` from the settings; it is no `BaseEntity`, so
   DDD.md's rule is "every entity stored in the database extends `BaseEntity`" (Agreed 1 said value object).
2. Building the launch command is a domain rule, `prepareLaunchPlan`, and `LaunchPlan` is a value object again.
3. VS Code merges the user's entries into the default key by key, and `null` hides one (checked: a renamed built-in kept
   its other fields). Four flat tables, which the Settings editor edits in place, were tried and dropped: they cluttered
   Aggregor's settings.
4. An invalid entry is left out with a warning; a session whose agent is gone fails with `AgentNotFoundError`.
5. Icons are a codicon id or an image path, relative ones inside the extension. Codex's and Antigravity's come from
   lobe-icons, since simple-icons carries neither, Codex's without its white tile; Copilot's is the `copilot` codicon.
6. One title rule for every agent: prefer a 7501 `title`, else the OSC title; trim status marks; drop the agent name,
   command or project folder where joined by `-`, `|` or `:` at either end; ignore an empty title, one of those names
   alone, an id, or a start time (OpenCode's `New session - 2026-11-09T09:26:37.754Z`). Claude's `claude · resume`
   placeholder no longer appears with `--resume ‹id›`.
7. Codex resumes through its picker (`resume`) and Antigravity through its most recent conversation (`-c`), since
   neither takes our id at start. Codex 0.167 still reports `working` for a moment at startup, so a fresh Codex session
   reopens through the picker; Esc there starts a new one, so it is left as is. Step 5 resumes Codex's own thread by its
   id instead.
8. The picker offers what is on `PATH`, through a port, rather than `findAll` leaving out uninstalled agents.
9. **Set as Default** ends the pick and the use case saves the default and shows the picker again, rather than the
   picker saving while open.
10. A session's tab shows the row's name; VS Code can rename only the active terminal, so a background tab catches up
    when it comes to the front.
11. Open Settings goes from `routes.ts` straight to `@pkg/vscode`, with no controller or service.
12. The session in front stays selected in the Sessions view; arrow keys still move the tree's focus, and a chosen
    session row is left selected while its session comes to the front.

**Verified (2026-11-09):** in the headless VS Code: the picker listed the five built-ins with the default first; Set as
Default wrote the setting and reordered; Claude started under its id and resumed with `--resume ‹id›`; a session from
before the change (`claude-code`) showed the warning icon; a renamed built-in kept its other fields, `null` hid one, an
added entry showed, and a broken one was left out with one warning per read of the setting; with every built-in hidden
and only `pi` installed, it started without the picker; `skipAgentPicker` started the default straight away; with none
installed the error named the command searched for. Copilot needed `/login` and Antigravity a sign-in, which the
headless window can't give, and OpenCode was at its free limit, so their status and titles were not checked end to end.
After review: the gear opened Aggregor's settings; a fake agent setting two titles renamed its tab with its row while in
front, a background tab kept its old name until it came to the front, and Rename from the row menu renamed the tab at
once; a second session of the same agent got its row selected as its tab opened; clicking a project row or empty space
left the session in front selected, and arrow keys plus Enter still opened another session; the picker showed Codex's
icon without its tile.

## Step 5: tmux sessions

**Branch:** `stack/harness-foundation/5/feat/tmux-sessions`

**Changes:**

- `assets/tmux.conf`, loaded with `-f`, so the user's `~/.tmux.conf` is not read: no prefix, `status off`, `mouse on`, a
  50,000-line history, `escape-time 0`, `focus-events on`, `extended-keys on`, `window-size latest`,
  `aggressive-resize on`, 24-bit colour and OSC 52, and `update-environment` for VS Code's terminal variables. A window
  sources it again when tmux already runs.
- Aggregor's tmux server listens on `tmux.sock` in the Aggregor folder (`tmux -S`), so a test's `AGGREGOR_HOME` has its
  own.
- A session's tab runs
  `tmux -S ‹socket› -f ‹conf› -u new-session -A -s ‹sessionId› -c ‹project› -- aggregor-pty … -- ‹agent›`: it attaches
  when the agent runs and starts it otherwise, so the agent gets the tab's terminal environment (git credentials
  included) and tmux answers its colour queries. The tab is transient: a reload or a quit closes it, which only
  detaches, and clicking the session attaches a new one.
- The domain takes the agent's `resumeArgs` once the session has worked, else its `args`. When `aggregor-pty` can't
  start the agent it prints why and waits for Enter.
- Codex resumes its own thread: run with `-c tui.terminal_title=["thread-title"]`, its title is the thread's id until
  the thread has a name; `aggregor-pty` stores a bare-UUID title as `agentSessionId`, and Codex's `resumeArgs` are
  `resume --no-daemon -c … ${agentSessionId}`. `--no-daemon` keeps its turns in its own process, so they stop with the
  session.
- An agent's `env` setting passes variables to its agent (`new-session -e`); Claude's built-in sets
  `CLAUDE_CODE_TMUX_TRUECOLOR=1`, so it keeps 24-bit colour in tmux.
- `ITmuxInfraService` (the tab's command, stop, running sessions) and `ITerminalInfraService` (tabs); a row shows exited
  when tmux no longer runs its agent, read on start, on window focus, when a terminal closes, after a session's tab
  opens, and after each stop.
- Remove Session confirms while the agent runs, kills its tmux session and closes its tab.
- **tmux check:** `tmux -V` before each start; missing or older than 3.2 fails with "Aggregor runs every session in tmux
  3.2 or newer, which isn't installed" and an **Install tmux** button for tmux's install page.
- **WSL:** `extensionKind: ["workspace"]`, so in a WSL window the extension runs on the Linux side.

**Decided:**

1. The tab starts tmux (`new-session -A`), and the extension picks start or resume. A first build started each agent
   from a hidden VS Code terminal and had the tab only attach, but tmux answers an agent's background-colour query only
   through an attached client, so agents picked palettes that didn't match the theme. A process the extension host
   starts was never an option: it lacks VS Code's terminal variables (the git extension's askpass) and carries its
   internals (`ELECTRON_RUN_AS_NODE`). Tabs that VS Code kept over a reload and restored after a quit, found by their
   command line, came back without their icon, which VS Code can't revive for a file icon, and ran the command they were
   opened with, so `aggregor-pty` had to pick start or resume; transient tabs replaced both.
2. Mouse on, so the wheel scrolls tmux's history; Shift+drag selects text natively.
3. No pkexec prompt and no bundled tmux: pkexec is missing in WSL and over SSH, and bundling means shipping and patching
   tmux, with no static macOS build. The one-click install terminal is held back; the error links to tmux's install page
   instead.
4. The socket sits in the Aggregor folder (`-S`) rather than `-L aggregor`, so tests and the user's dev build never
   share a server.

**Verified (2026-11-09):** in the headless VS Code with a fake agent and Claude: a new session ran in tmux with the
window's `GIT_ASKPASS` and `VSCODE_GIT_IPC_HANDLE` and no `ELECTRON_RUN_AS_NODE`; closing its tab left the agent running
and the row idle, and clicking it reattached with tmux's history; a window reload reattached the same tmux client, found
by its command line; after a graceful quit with VS Code's last window, VS Code restored the tab attached to the same
agent; `tmux kill-server` closed the tab, turned the row exited, and opening Claude's session ran
`claude --resume ‹id›`; Claude's status (working, then finished) and title reached the row and tab through tmux; Remove
Session asked first, killed the tmux session and closed the tab; with tmux off `PATH` the error and its Install tmux
button showed and no row was left behind. When the skill's stop kills VS Code instead, VS Code restores session tabs as
plain shells. After the switch to the tab starting tmux: a probe agent's OSC 11 query got the theme's background
(`rgb:1919/1a1a/1b1b`), which the hidden-terminal start left unanswered; a new session opened in 166 ms; a reload
reattached the tab, found by its `new-session -A` command line; closing the tab left the agent running and clicking the
row attached to it; with `hasWorked` set and the tmux session killed, clicking the row ran the agent's `resumeArgs` with
the session's id filled in and `AGGREGOR_SESSION_ID` set. `cargo test` covers start, resume and a removed session.
Claude and Codex then still drew different colours than in a plain terminal: Claude drops to 256 colours whenever `TMUX`
is set, and Codex asked for the background before tmux had learned it from the new tab (about 20 ms) and got no answer.
With Claude's built-in `env` setting `CLAUDE_CODE_TMUX_TRUECOLOR=1`, its logo drew `215,119,87` as in a plain terminal
instead of 256-colour `215,135,135`, and a user `env` entry merged with the built-in one; with `aggregor-pty` waiting
for tmux to answer, three Codex sessions in a row shaded the composer `52,53,54` as in a plain terminal; the wait was
dropped afterwards, since Codex looked right without it in use. After the switch to transient tabs and Codex's own ids:
a new Codex session ran `codex --no-daemon -c tui.terminal_title=…`, its row stored the thread's id as `agentSessionId`
within a second, and after a turn the row took the thread's name; a reload closed the tab, left the agent running with
no client, and clicking the row reattached the same process, with its icon; with the tmux session killed, clicking the
row ran `codex resume --no-daemon … ‹thread id›` and showed that thread. A Codex session that never got a message,
killed the same way, ran its resume and closed at once: Codex reports `working` for a moment at startup, and saves no
thread before a message. `cargo test` covers the stored id.

## Step 6: session alerts

**Branch:** `stack/harness-foundation/6/feat/session-alerts`

**Changes:**

- A notification for every state change of a session out of view, meaning its terminal is not the active terminal of a
  focused window:

  | State                       | Notification                           |
  | --------------------------- | -------------------------------------- |
  | blocked, permission         | ‹session› needs approval: ‹msg›        |
  | blocked, question           | ‹session› has a question: ‹msg›        |
  | blocked, auth               | ‹session› needs you to sign in: ‹msg›  |
  | blocked, no kind            | ‹session› is waiting for you: ‹msg›    |
  | done, or idle after working | ‹session› finished: ‹msg›              |
  | error                       | ‹session› stopped with an error: ‹msg› |
  | exited                      | ‹session›'s agent exited               |
  | idle, otherwise             | ‹session› is idle                      |
  | working                     | ‹session› is working: ‹msg›            |
  | unknown                     | ‹session› stopped reporting its status |

- **Inside VS Code:** the focused window shows it, whichever workspace it has open. **Open** runs the open command,
  which attaches the session in that window and shows its project there.
- **From the OS,** when the window isn't focused: `notify-send --wait` on Linux (0.8.8 here) filed under VS Code with a
  `desktop-entry` hint, so a click on it makes GNOME bring VS Code's most recently used window forward; that window
  opens the session when it came into focus within 1.5 seconds of the notification closing. `osascript` on macOS, and a
  Windows toast through `powershell.exe` from WSL, whose click opens a
  `vscode://salmanafzal.aggregor-app/openSession?sessionId=…` link made by `env.asExternalUri` for the extension's URI
  handler.
- **One sender:** Aggregor's one window sends the OS notification when it isn't focused; a second open window sends one
  too.
- The Sessions view badge counts sessions blocked, errored, or finished and unseen; hovering lists them.
- `aggregorApp.notifyOn` lists the states that notify.
- A Linux desktop notification shows the agent's logo, and Aggregor's in its header. Agent icons are image paths only:
  Copilot got its logo and an entry without an icon Aggregor's, so no agent shows a codicon.

**Decided:**

1. Every state notifies except `working` and `unknown` by default, and an `aggregorApp.notifyOn` list of states changes
   that. `working` out of view mostly follows something the user just did, such as answering a prompt and switching
   away, and `unknown` carries no news.
2. A state notifies only once it has held for 3 seconds. Antigravity reports `blocked kind=auth` for about 2 seconds at
   every start, and quick sequences then raise one notification.

3. Stale notifications are accepted: VS Code can't close a notification an extension showed, but **Open** still goes to
   the session, and the badge and row are always current.
4. A second window sends a second notification; if it ever matters, a window claims each change in the database with an
   update only one window can win.
5. A click brings VS Code forward through GNOME, the only one allowed to, rather than an Open button whose link VS Code
   opened in the background (tried first) or `code ‹workspace›`, which an untitled workspace has no path for. With
   several VS Code windows, GNOME picks the most recently used; landing on the right one waits in the README's "If the
   users asked". macOS and WSL ship too, untested, for contributors to try.
6. `notify-send` runs with `NOTIFY_IGNORE_PORTAL=1`: a `notify-send` run from a snap terminal on 2026-11-10 printed
   "Actions are not supported by this notifications server", since libnotify then uses the portal, though GNOME Shell
   50.1 lists `actions` among its capabilities.

**Verified (2026-11-10):** in the headless VS Code with a fake agent (`sleep`) whose row was written as `aggregor-pty`
would: with the session's tab behind an untitled file, a permission wait raised "jsTester #2 needs approval: Run npm
test?" with Open after about 3 seconds, and Open brought the session's tab to the front; the Sessions icon's badge
showed 1 and "jsTester #2 · needs input"; working raised nothing; idle, working and idle again within 3 seconds raised
one "finished"; with `notifyOn` set to `["working"]`, a permission wait raised nothing and working raised "is working".
A session link run through `code --open-url` asked once whether Aggregor may open it, then opened the session. On the
user's GNOME 50.1: an `xdg-open` of the link from the Open button opened the session but left VS Code in the background;
a notification with VS Code's `desktop-entry` hint and `--wait` brought VS Code forward from another workspace on a
click, but its most recently used window; `code ‹file›` run in another VS Code window's terminal brought the right
window forward. With a stand-in `notify-send` in the headless VS Code: its arguments were `--app-name`, `--app-icon`,
`--wait`, `--hint string:desktop-entry:com.microsoft.VSCode`, the logo's `image-path` hint, then the texts; a window
that came into focus 0.6 seconds after it closed opened the session, and one that didn't within 1.5 seconds opened
nothing. Not checked: the WSL toast and macOS.

## Step 7: Aggregor's workspace, saved without asking

**Branch:** `stack/harness-foundation/7/feat/saved-aggregor-workspace`

**Changes:**

- The first switch, in a window that isn't a saved workspace with the anchor folder at folder 0, writes
  `~/.aggregor/anchor/Aggregor.code-workspace` (the anchor folder, then the project) and opens it in the window with
  `vscode.openFolder`, which reloads it; `sessionToReopen.json` beside it keeps the session, and the reloaded window
  opens it again. Add Project in an empty window opens it the same way.
- The offer to save the untitled workspace goes: `startWorkspaceSaveOffer`, `claimWorkspaceSaveOffer`,
  `saveWorkspaceAs`, the `saveOffered` marker and `workspace.constant.ts`.

**Decided:** the reload once instead of a dialog; a workspace already saved with the anchor at folder 0 is kept.

**Verified (2026-11-10):** in the headless VS Code, a session started in a second project while the window showed
jsTester wrote the workspace file, reloaded the window into "Aggregor (Workspace)" with no question, and the reloaded
window took `sessionToReopen.json` and attached the session's tab again; a switch to a jsTester session then swapped
folder 1 in place, which VS Code wrote into the file, with no reload.

## Step 8: session tasks

**Branch:** `stack/harness-foundation/8/feat/session-tasks`

A session row lists what runs inside it: every OSC 7501 record with an `id`, which Claude Code sends for each running
subagent.

**Changes:**

- A `sessionTasks` table: the shared columns, plus `sessionId` (pointing at `sessions`), `recordId` (the report's `id`
  path, unique together with `sessionId`), `status`, `statusKind`, `statusMessage`, `statusProgress` and `title`. Only
  the binary writes it.
- `aggregor-pty` writes each report with an `id` to its task's row. `clear` with an `id` deletes that task and every
  task beneath it (`build/test` is beneath `build`); `clear` with none deletes them all. When the agent exits, its
  working and blocked tasks go and its done and error tasks stay, as the spec's lifetimes say. It keeps the spec's
  limits: 256 records per session, 8 levels deep.
- `SessionTaskEntity` and `SessionTaskRepository` on the base pieces; a session's tasks load with the sessions.
- Rows: a session with tasks expands to one child row per task, with its status icon, its title (or its id's last part
  when it has none), its message in the tooltip and its progress. A nested id nests under its parent. Clicking a task
  opens its session.

**To decide:**

1. A task that repeats its session. OpenCode reports its whole conversation as a second record (`id=ses_…`, with the
   session's own title) and clears it after each turn. Recommended: hide a task whose title is its session's agent
   title, a rule for every agent rather than a special case for OpenCode.
2. Whether tasks alert. The spec lets a blocked task sit under a root that still says `working`. Recommended: a blocked
   or errored task raises the step 6 notification ("‹session› › ‹task› needs approval: ‹msg›"), counts in the badge, and
   shows its session as blocked; working and done tasks only show as rows.
3. Expanded or collapsed. Recommended: a session expands while any of its tasks works or is blocked, and collapses again
   when the last one clears.
4. The name. Recommended: tasks, after the spec's "sub-tasks": only Claude's are subagents.

**Verify:** Claude with two parallel subagents shows two child rows that go when each finishes; a subagent's permission
prompt notifies; OpenCode shows no child row.

## Not in phase 2

- OS notifications for SSH sessions: there the extension runs on the host, so it needs a helper on the local machine.
- The socket between the extension and a running binary.
- Native Windows through psmux.
- More built-ins (crush, goose, pi, grok), each one settings entry.
