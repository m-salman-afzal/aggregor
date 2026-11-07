# Phase 2: harness foundation

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
- Windows, projects, sessions and live status live in related SQLite tables at `~/.aggregor/aggregor.db`, outside VS
  Code's storage, behind a base entity, a base repository and a base service.
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
- crush, goose, pi and grok are also installed; crush and goose report OSC 7501 per areweosc7501yet.com. Each would be
  one settings entry.

## Agreed

### Agents as settings

1. **Agents are data.** `ClaudeCodeHarnessInfraService`, `IHarnessInfraService(s)`, the `LayerMap` and
   `harness.utils.ts` go. A harness is a domain value object read from settings, a domain function builds its launch
   command, and the harness id is its settings key.
2. **`aggregorApp.harnesses`**, keyed by command name: `{name, command, args, resumeArgs, icon}`. `command` defaults to
   the key. The built-ins merge with the user's entries, and `null` hides one. `machine` scope, so only user settings
   can define commands. No `env` field; `${sessionId}` is the only variable. Edited in settings.json.
3. **Built-ins:** `claude`, `codex`, `agy` (Antigravity, replacing Gemini CLI, which is deprecated), `opencode`,
   `copilot`. Their entries are under step 4.
4. **Resume:** `resumeArgs` once the session has reported `working` at least once; `args` before that. With tmux this
   only matters once the tmux session is gone, such as after a reboot or an agent exit.
5. **Icons:** a codicon id or an image path, relative paths inside the extension. Official logos in `assets/harnesses/`,
   renamed from `assets/models/`.
6. **Picker:** "New Session" (was "New Claude Session") lists the harnesses whose command is on PATH; with one there is
   no picker. The default comes first, preselected, and each item has a "Set as default" button.
   `aggregorApp.defaultHarness` (default `claude`) and `aggregorApp.skipHarnessPicker` (default false).

### Status

7. **Status and titles come from the agent's output:** OSC 7501 for status, OSC 7501 `title` or OSC 0/2 for titles, read
   by `aggregor-pty`. The hooks, `AGGREGOR_STATUS_FILE`, status files, transcript lookup, the interrupt settle (#71),
   `idleTitleMark` and `Terminal.name` polling go. A renamed session keeps getting status and titles.
8. **Statuses are the spec's:** idle, working, done, blocked (kind permission, question or auth, with a message) and
   error, plus `exited` (the agent or its tmux session is gone) and `unknown` (no report yet, or cleared). They live on
   the session's own row. The message shows in the tooltip and notifications; progress shows as `42%` on the row. The
   root record is the session's status; records with an `id` are the session's tasks, under step 8. The binary enforces
   the spec's limits.
9. **Done means not seen yet.** The existing unread rule carries over: a turn that ends while its session is out of view
   shows as done until the session comes into view. It covers agents that report `done` and those that go straight back
   to `idle` (Codex, OpenCode).

### Alerts

10. **State changes of a session out of view notify:** inside VS Code in the focused window, whichever workspace it
    shows, and through the OS when no VS Code window is focused. The Sessions view badge counts sessions blocked,
    errored, or finished and unseen. Which states, and how, under step 7.

### Runtime

11. **`aggregor-pty`**, Rust, in `apps/pty`: portable-pty runs the agent, rusqlite (bundled SQLite) writes its status,
    and a small hand-written OSC scanner with tests reads the stream. It answers the 7501 check in the stream, passes
    every byte through, forwards resizes and records the exit. One per session, inside its tmux session.
12. **Packaging:** a VSIX per platform (linux x64 and arm64 as static binaries, darwin x64 and arm64), built in CI, plus
    a universal one without the binary. Windows through WSL now; native Windows through psmux later.
13. **tmux 3.2 or newer is required**, with its own server (`-L aggregor`) and its own config shipped in the extension.
14. **tmux check and one-click install** before a session starts or opens; under step 6.
15. **Lifecycle:** a session's terminal runs
    `tmux -L aggregor new-session -A -s ‹sessionId› -c ‹project› -- aggregor-pty … -- ‹agent›`, for new and reopened
    sessions alike. Closing the tab detaches; Remove Session kills the tmux session; an agent exit marks the session
    exited, and opening it again resumes.

### Storage

16. **SQLite at `~/.aggregor/aggregor.db`**, overridden by `AGGREGOR_DATA_DIR` for tests, in WAL mode, with related
    tables that share `id` (a UUID v7), `updatedAt` and `deletedAt`, camelCase names, and a base entity, base repository
    and base service; under step 1. The extension uses `@effect/sql-sqlite-node` 4.1.2 (Effect's client on Node's
    built-in `node:sqlite`, so no native module); the binary uses rusqlite. No migrations before 0.1.0: a schema change
    starts the database from empty, and today's `globalState` data is not imported. The anchor folders stay in VS Code's
    global storage.
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

Windows, projects and sessions move out of `globalState` into related tables in `~/.aggregor/aggregor.db`, behind a base
entity, a base repository and a base service. Nothing changes for the user.

**Tables.** Every table starts with the same three columns, and every name is camelCase:

| Column      | Type               | Meaning                                                                                            |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `id`        | `TEXT PRIMARY KEY` | a UUID v7: unique, sorted by creation time and carrying that time, so no `uuid` or `createdAt` too |
| `updatedAt` | `INTEGER NOT NULL` | milliseconds since the epoch, set on every write                                                   |
| `deletedAt` | `INTEGER`          | set by a soft delete; reads skip the row                                                           |

| Table            | Its own columns                                       | Relations                                              |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `windows`        | `key` (unique: the window key from `findWindowKey`)   | has many projects through `windowProjects`             |
| `projects`       | `path` (unique)                                       | has many sessions; belongs to many windows             |
| `windowProjects` | `windowId`, `projectId` (unique together)             | a project added to a window with Add Project           |
| `sessions`       | `projectId`, `harnessId`, `name`, `customName` (null) | belongs to one project; step 2 adds its status columns |

- Relations point at `id` with `REFERENCES`, and `PRAGMA foreign_keys = ON` checks them.
- A project's row is upserted by path the first time it is used: added to a window, or given a session (a workspace
  folder's project too).
- Remove Project soft-deletes the window's `windowProjects` row. The project and its sessions stay, so adding it again
  lists them again, as today. Remove Session soft-deletes the session.
- WAL and a busy timeout on every connection. The schema's version sits in `PRAGMA user_version`; a database with
  another version has its tables dropped and created again, inside one transaction, so every schema change before 0.1.0
  starts from empty. No migrations. Dropping rather than deleting the file keeps windows that have it open on the same
  database.

**Base pieces:**

- **`EntityIdValueObject`** (domain): the branded UUID v7 that every entity's `id` is; it replaces
  `SessionIdValueObject`. Its factory service, `entityId.domainService.ts`, gives what the three old columns did:
  - `makeEntityId`: a new id, from Effect's `SecureRandom.uuidV7`, which also orders the ids made within one
    millisecond;
  - `getEntityIdCreatedAt`: the creation time, from the id's first 48 bits;
  - order: ids sort by creation time as plain text, so `ORDER BY id` lists rows in the order they were made.
- **`BaseEntity`** (domain): `id`, `updatedAt` and `deletedAt`, with `DateTime.Utc` timestamps. Every entity extends it.
  Its factory, `fromRow`, cleans a stored row (NULL to absent, the milliseconds of every `…At` column to `DateTime`) and
  decodes it into the entity, failing with a tagged error on a bad row.
- **`IBaseRepository<Entity, AddRequest>`** (domain): `add`, `findById`, `findMany`, `update`, `upsert` and
  `softDelete`. `ISessionRepository`, `IProjectRepository` and `IWindowRepository` extend it.
- **`makeBaseRepository`** (infrastructure), on Effect's `SqlClient`, given a table, its unique columns, and the entity
  its rows decode into:
  - reads skip soft-deleted rows and list rows in `id` order;
  - `add` makes the id with `makeEntityId`;
  - `update` writes only the columns it is given, plus `updatedAt`, so two writers (the extension and `aggregor-pty`)
    never overwrite each other's columns;
  - `upsert` inserts, or updates the given columns of the row with the same unique columns, bringing back a soft-deleted
    one;
  - every row it returns goes through the entity's `fromRow`, so services only ever receive entities.
- **`BaseService`** (application): `base.service.ts`, the same six calls for any entity's repository. The session,
  project and window services build on it instead of calling their repositories, and it holds the one mapping from
  repository errors to messages.
- No Effect `Model.Class` row models: the entity's `fromRow` reads rows and the repository writes plain columns, so a
  second schema per table would repeat the entity. Effect's `SqlModel.makeRepository` was weighed too: its update
  rewrites every column and it finds rows only by id.

**Other changes:**

- Add `@effect/sql-sqlite-node` 4.1.2. `node:sqlite` works in VS Code 1.145's Electron (Node 24.22, SQLite 3.53.4), and
  `vite.config.ts` already keeps every `node:` import external.
- A database layer opens the file, creating `~/.aggregor` with mode 0700, turns on foreign keys and creates the tables.
- `ProjectEntity` becomes the stored project. The tree's project rows become `ListedProjectValueObject` (path, name,
  added), since a workspace folder is listed before its project has a row.
- `SessionEntity` gains `projectId`; `projectPath` comes from its project through a join. `withName` and
  `withCustomName` go, since `update` writes single columns.
- `SessionRepository`, `ProjectRepository` and a new `WindowRepository` (which owns `windowProjects`) build on the base
  repository instead of read-modify-writing `globalState`; `modifySessions` and `modifyAddedProjectPaths` go.
- `StoredSessionsModel` and `StoredAddedProjectPathsModel`, with their `version` fields, go; `database/models/` holds
  the tables' SQL.
- `globalstorage.md` becomes `storage.md` and covers the database too. The `agentSessions` and
  `addedProjectPathsByWindow` keys move to "no longer read".

**Decided:**

1. The file lives at `~/.aggregor/aggregor.db`; windows keep re-reading on focus until step 3 watches the database; the
   generic `update` replaces the read-modify-write; today's data is not imported.
2. The entity factory runs inside the base repository, on every row it returns.
3. A `BaseService` now, as the foundation the entity services build on.
4. One id per row: a UUID v7 value object replaces `id`, `uuid` and `createdAt`. A session's id is also the id its agent
   gets (`--session-id`; Claude Code accepts a UUID v7, checked on 2026-11-07), so `SessionIdValueObject` folds into
   `EntityIdValueObject` and no `sessionUuid` rename is needed.
5. Relations point at that id, which also keeps ids unique across machines if databases are ever merged.

**Verify:** add and remove projects; start, rename and remove sessions; reload; then read the rows with `sqlite3` and
check the relations, the soft deletes, the timestamps, and that ids sort in creation order.

## Step 2: the `aggregor-pty` binary

**Branch:** `stack/harness-foundation/2/feat/pty-binary`

**Changes:**

- `apps/pty`: a Rust crate building `aggregor-pty`, with a pinned toolchain (`rust-toolchain.toml`). Dependencies:
  portable-pty, rusqlite (bundled), base64.
- Usage: `aggregor-pty --database ‹path› --session ‹sessionId› -- ‹command› ‹args›…`.
- What it does:
  - puts its own terminal in raw mode and starts the agent in a pty of the same size;
  - copies input to the agent and the agent's output out, byte for byte;
  - scans the output for OSC 7501 and OSC 0/2, across read boundaries, ending in BEL or ST;
  - answers `OSC 7501 ; ?` at once;
  - validates reports per the spec's limits and writes the root record and the latest title onto the session's row;
  - forwards window resizes;
  - when the agent exits, writes `exited` and exits with the agent's code.
- The extension's schema gains the status columns on `sessions`: `status`, `statusKind`, `statusMessage`,
  `statusProgress`, `agentTitle`, `hasWorked` and `statusChangedAt`. Only the binary writes them, one `UPDATE` of those
  columns and `updatedAt` by `id`; the extension's row model has them read-only. The schema's new version starts the
  database from empty once.
- Rust tests: the scanner (split sequences, both terminators, oversize, bad base64, control characters, the check) and
  one end-to-end run of a `printf` script under the binary against a temporary database.
- CI: `cargo fmt --check`, `cargo clippy -D warnings` and `cargo test`; a build matrix for `x86_64` and `aarch64` musl
  on Linux and both macOS targets; `vsce package --target` for each; `release.yaml` publishes every target.
- The extension's build and the `verify-in-vscode` skill build the binary for the host and put it at
  `apps/extension/bin/aggregor-pty`.
- Renovate's `cargo` manager covers the crates.

**Decided:**

1. Linux binaries are built with `cargo-zigbuild` on one Linux runner, for both musl targets.
2. A universal VSIX without the binary is published too; it only tells the user to reopen in WSL (Windows) or that the
   platform is unsupported, since Windows users couldn't otherwise install the extension and see that message.
3. The reply to the check is the bare `OSC 7501 ; ? ST`.

**Verify:** the Rust tests; then run Claude, Codex and Antigravity under the built binary inside tmux and compare their
rows with the reports logged in the tests above.

## Step 3: status from OSC 7501

**Branch:** `stack/harness-foundation/3/feat/status-from-osc-7501`

Session terminals start the agent through `aggregor-pty` (no tmux yet), and status and titles come from the session's
row.

**Changes:**

- `StatusValueObject` becomes the spec's states plus `exited` and `unknown`, with `kind`, `message` and `progress`.
- `SessionEntity` gains the status fields, read through `SessionRepository` like the rest of the session; there is no
  separate status repository. A watch on the database's WAL file, confirmed with `PRAGMA data_version`, refreshes
  sessions and projects for every window.
- `startSessionTitleSync` reads `agentTitle` instead of `Terminal.name`. `getSessionTitle` also strips trailing status
  marks and ignores titles that are only an id.
- Rows: an icon per state, the message in the tooltip, progress in the description, and the unread rule (Agreed 9).
- Resume uses `hasWorked` instead of looking for Claude's transcript.
- Deleted: `assets/hooks.json`, `HOOKS_FILE`, `STATUS_ENV`, `INTERRUPTED_TURN_GRACE`, `status.service.ts`, Claude's
  `status.utils.ts`, `transcript.utils.ts` and `claudeCode.transformer.ts`, `idleTitleMark`,
  `watchSessionTerminalTitles` and `sessionTerminalTitles`.
- Claude's harness service shrinks to its launch plan until step 4 removes it.

**Decided:**

1. Row icons: working keeps today's spinner; blocked `bell-dot`; done `check`; error `error`; idle `circle-outline`;
   exited `debug-stop`; unknown `circle-large-outline`, dimmed.
2. A session that is `unknown` while its process runs (Copilot) shows as idle with no turn tracking, so it never looks
   stuck.

**Verify:** in the headless VS Code with Claude: idle, working, done, then idle once viewed; a permission prompt shows
blocked with its message; Esc and Ctrl+C mid-turn go idle; `/exit` goes exited; a renamed session still updates.

## Step 4: harnesses from settings

**Branch:** `stack/harness-foundation/4/feat/harness-settings`

**Changes:**

- `aggregorApp.harnesses` and `aggregorApp.defaultHarness` in `package.json`, `machine` scope, with the built-ins below
  as the default value.
- Domain: `HarnessValueObject`; `HarnessIdValueObject` becomes any settings key; a domain function builds the launch
  plan from a harness, a session and whether it has worked, filling in `${sessionId}` with the session's id.
- The terminal infra service wraps the plan in `aggregor-pty`, since the binary and database paths are infrastructure.
- Deleted: `services/claudeCodeHarness/`, `harness.infraService.interface.ts`, `harnessInfraServices.layer.ts`,
  `harness.utils.ts`, `MODEL_ICONS`.
- `assets/models/` becomes `assets/harnesses/`, with official logos for all five.

**Built-ins:**

| Key        | Name           | `args`                       | `resumeArgs`                 |
| ---------- | -------------- | ---------------------------- | ---------------------------- |
| `claude`   | Claude Code    | `--session-id ${sessionId}`  | `--resume ${sessionId}`      |
| `codex`    | Codex          | none                         | `resume` (its picker)        |
| `agy`      | Antigravity    | none                         | `-c` (most recent)           |
| `opencode` | OpenCode       | `--session ses_${sessionId}` | `--session ses_${sessionId}` |
| `copilot`  | GitHub Copilot | `--session-id ${sessionId}`  | `--session-id ${sessionId}`  |

**Decided:**

1. Codex resumes through its picker (`resume`, which lists that folder's sessions) and Antigravity through its most
   recent conversation (`-c`), since neither takes our id at start.
2. One title rule for every harness: prefer a 7501 `title` once the agent has sent one; otherwise take the OSC title,
   drop the harness name, command or project folder name when joined by `-`, `|` or `: ` at either end, trim status
   marks at both ends, and ignore an empty title, the harness name or an id.
3. VS Code's merge of an object setting's default with the user's value is checked in this step; if it doesn't merge key
   by key, `readSettings` merges.
4. A key whose `command` isn't installed fails in its terminal with the shell's error; the picker hides it.

**Verify:** start each of the five from the built-in settings, check status and titles, then kill each one and reopen it
to check resume. Override a built-in and hide one with `null`.

## Step 5: harness picker

**Branch:** `stack/harness-foundation/5/feat/harness-picker`

**Changes:**

- "New Claude Session" becomes "New Session"; "New Session..." keeps asking for the project first.
- A quick pick of the harnesses found on PATH: icon, name, the command as its description, the default first and
  preselected, and a "Set as default" button that writes `aggregorApp.defaultHarness` to user settings.
- `aggregorApp.skipHarnessPicker` starts the default straight away.
- No harness on PATH: an error naming the commands looked for, with **Open Settings**.

**Decided:** commands are found by searching `PATH` in the extension host (plus `PATHEXT` on Windows) each time the
picker opens, so a newly installed CLI shows up without a reload.

**Verify:** one harness on PATH skips the picker; several show it; Set as default reorders; the skip setting goes
straight to the default.

## Step 6: tmux sessions

**Branch:** `stack/harness-foundation/6/feat/tmux-sessions`

**Changes:**

- `assets/tmux.conf`, loaded with `-f`, so the user's `~/.tmux.conf` is not read: no prefix, `status off`, `mouse on`,
  `set-titles on`, `window-size latest`, a large `history-limit`, `escape-time 0`, `extended-keys on`, `focus-events on`
  (Claude asks for it).
- Session terminals run `tmux -L aggregor -f ‹conf› new-session -A -s ‹sessionId› -c ‹project› -- aggregor-pty …`.
- Closing the tab detaches; Remove Session runs `kill-session`; on activation, sessions with no tmux session left (after
  a reboot) become exited.
- **tmux check:** before a session starts or opens, run `tmux -V`. If tmux is missing or older than 3.2, a notification
  says "Aggregor runs sessions in tmux, which isn't installed", with **Install tmux**. The button opens a terminal that
  runs the install command for the system (apt-get, dnf, pacman, zypper or apk, from `/etc/os-release`;
  `brew install tmux` on macOS), where the user types their sudo password. When it exits successfully, the extension
  checks again and carries on with the session that was asked for. An unknown package manager opens tmux's install page
  instead.
- **WSL:** `extensionKind: ["workspace"]`, so in a WSL window the extension runs on the Linux side; a local Windows
  window gets **Reopen in WSL**.

**Decided:**

1. The session's variables go through `new-session -e`, since the aggregor tmux server keeps the environment of
   whichever window started it.
2. Mouse on, so the wheel scrolls tmux's history; Shift+drag selects text natively.
3. No pkexec prompt and no bundled tmux: pkexec is missing in WSL and over SSH, and bundling means shipping and patching
   tmux, with no static macOS build.

**Verify:** close a tab while the agent works and reopen it; reload the window; Remove kills the tmux session;
`tmux -L aggregor kill-server` marks every session exited and opening one resumes it; start VS Code with tmux left off
`PATH` to check the install flow.

## Step 7: session alerts

**Branch:** `stack/harness-foundation/7/feat/session-alerts`

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

- **Inside VS Code:** the focused window shows it, whichever workspace it has open. **Open** attaches the session in
  that window (tmux takes a second client) and shows its project there.
- **From the OS,** when no VS Code window is focused: `notify-send` on Linux (0.8.8 here) with an **Open** action,
  `osascript` on macOS, and a Windows toast through `powershell.exe` from WSL.
- **One sender:** each window keeps its focus, with a heartbeat, on its `windows` row. On a state change, a window sends
  the OS notification only after claiming that change in the database, with an update only one window can win, so
  several open windows send one notification.
- The Sessions view badge counts sessions blocked, errored, or finished and unseen; hovering lists them.

**Decided:**

1. Every state notifies except `working` and `unknown` by default, and an `aggregorApp.notifyOn` list of states changes
   that. `working` out of view mostly follows something the user just did, such as answering a prompt and switching
   away, and `unknown` carries no news.
2. A state notifies only once it has held for 3 seconds. Antigravity reports `blocked kind=auth` for about 2 seconds at
   every start, and quick sequences then raise one notification.

**To decide:**

1. Stale notifications. VS Code can't close a notification an extension showed, so one can outlive its state.
   Recommended: accept it; **Open** still goes to the session, and the badge and row are always current.

**To check when this step starts,** before building on it: clicking an OS notification. VS Code has no API to bring a
window forward, so the plan is that the **Open** action runs `code` with that window's workspace, which should focus the
window that has it open. Check it for saved and untitled workspaces, and in WSL. On macOS, `osascript` notifications
can't carry an action, so a click does nothing useful there; if that matters, the options are `terminal-notifier` (a
Homebrew install) or a notification crate inside `aggregor-pty`.

**Verify:** two windows on different workspaces; a permission prompt in a session out of view raises the notification in
the focused window, and **Open** attaches the session there; with VS Code unfocused, one OS notification appears, not
one per window; Antigravity's startup auth raises nothing.

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
   title, a rule for every harness rather than a special case for OpenCode.
2. Whether tasks alert. The spec lets a blocked task sit under a root that still says `working`. Recommended: a blocked
   or errored task raises the step 7 notification ("‹session› › ‹task› needs approval: ‹msg›"), counts in the badge, and
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
