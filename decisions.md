# Decisions

What we decided, what we weighed it against, and why: dependencies, architecture, and the problems we hit and how we
solved them. The code, [DDD.md](DDD.md) and [storage.md](storage.md) say what is there now; this file says why.

Add an entry when a decision is agreed, in the same commit as the code it shapes, under the section it belongs to. When
a decision changes, rewrite its entry to the new one and move what it replaced into **Options**, so each topic has one
current entry. Leave a field out rather than guess.

```markdown
### What we decided (YYYY-MM-DD, #PR)

- **Problem:** what forced a choice.
- **Options:** each one weighed, and why it lost.
- **Decision:** what we picked.
- **Why:** the reason it won.
```

## Product

### Agents run in their own terminal UIs (2026-10-08)

- **Problem:** T3 Code, Conductor and Orca each build a UI around coding agents; aggregor wants their features inside a
  normal VS Code window.
- **Options:** an ACP client with a webview chat UI (the first prototype; its dead code went in the M1 cleanup, #23); VS
  Code's chat sessions API, which is proposed and so unusable from a Marketplace extension; each agent's own TUI.
- **Decision:** each agent's native TUI (Claude Code first; Gemini CLI, OpenCode and Codex later) in a terminal opened
  as an editor tab, managed from a native TreeView.
- **Why:** VS Code already has terminals, trees, watchers, Source Control and diffs; rebuild nothing it ships, and use
  only stable APIs.

### Review agent edits with git (2026-10-08, planned for M3)

- **Decision:** the index is the accepted baseline: staging accepts a change and restoring rejects it, in git's own diff
  with per-hunk staging. No custom diff UI.
- **Why:** same as above: Source Control and its diffs already exist.

### Where sessions run: {local, SSH host} × {project root, git worktree} (2026-10-08)

- **Decision:** SSH is a must-have, and closing a tab must never kill the agent; tmux (M2) detaches it, and clicking the
  session reattaches.

## Working process

### Claude implements, the user decides (2026-10-08)

- **Options:** the user types while Claude guides (the earlier learning mode).
- **Decision:** Claude writes the code; the user decides where code goes, which APIs and how. Each PR starts with a
  decision list with a recommended default per item. Every commit needs the user's explicit OK, even after a stack's
  decisions are approved (2026-10-31).
- **Why:** the user owns the design and reviews each change before it is committed.

### Stacked PRs (2026-10-31, #41)

- **Decision:** small feature-sliced PRs on `stack/<name>/<n>/<type>/<slug>` branches, cut by the `stack` skill. Auto PR
  opens each into the branch below and joins them into a GitHub stack; the top PR lands with a merge commit, never a
  squash. Once the branches below have landed, the lowest open branch opens into dev (2026-11-05, #63).

### Conventions are enforced by lint, not prose (2026-11-03)

- **Problem:** rules written only in AGENTS.md or DDD.md get skipped.
- **Decision:** each agreed convention gets an ESLint rule in the same PR: `no-restricted-syntax` selectors,
  `@typescript-eslint/naming-convention` per file glob, `no-restricted-imports` regexes, and the local rules in
  `eslint.plugin.ts`. When no installed rule can check it, write a selector rather than add a plugin.
- **Why:** lint constrains Claude better than docs do.

### Comments are rare and say only what the code does now (2026-11-02; rare since 2026-11-07)

- **Problem:** comments restated what well-named code already says, and described history and options not taken.
- **Decision:** a comment only where the code can't say why at a glance, such as a platform limit or a hidden
  constraint, in one line; no history, no library defaults we override, no options we didn't take. History and options
  go here instead.
- **Why:** the naming rules make code readable on its own, so comments stay a rarity.

### Ledgers for storage and decisions (2026-10-09, 2026-11-07)

- **Decision:** `storage.md` gets an entry for anything new the extension stores: a table in its database, a file under
  `globalStorageUri`, or a key in `globalState`; this file gets every decision, kept up to date each session.
- **Why:** the user wants a running record of what the extension stores, and of each choice and its reasons.

### Verify changes in a headless VS Code (2026-11-01)

- **Problem:** every visible test window interrupted the user.
- **Options:** a visible window; Xvfb, which the user turned down to stay on Wayland; mutter `--headless` on a private
  D-Bus session.
- **Decision:** the `verify-in-vscode` skill: headless mutter, driven over CDP on port 9447, reading the trace log from
  disk. Stop, UserPromptSubmit and SessionEnd hooks stop it.
- **Why:** nothing it starts may outlive the turn that started it.

### Test builds never go into the real VS Code profiles (2026-10-31)

- **Problem:** a local `.vsix` install records `source: "vsix", pinned: true`, so VS Code ignored v0.0.4 from the
  Marketplace.
- **Decision:** test builds run only in the isolated verify profile; the real profiles install from the Marketplace.

## Architecture and code rules

### DDD layers: domain, application, infrastructure, presentation (2026-11-02 to 2026-11-05, #55 to #66)

- **Problem:** services called VS Code and Claude Code directly, so the use cases depended on both.
- **Decision:** four layers with dependencies pointing inward; application declares the interfaces that infrastructure
  implements, and `vscode` is imported at runtime in one file, `vscode.api.ts` (in `@pkg/vscode` since 2026-11-09).
  DDD.md has the details; `eslint.layers.ts` checks imports and names.
- **Why:** a use case never depends on VS Code or on one agent.

### A base entity, a base repository and a base service (2026-11-07)

- **Problem:** with related tables, every repository would repeat the same reads, writes and soft deletes, and every
  entity the same id and timestamps.
- **Options:** Effect's `SqlModel.makeRepository`: its reads are `select *`, so a row can't carry what it reads through
  a join (a session's project path); its update writes the whole row outside a transaction; its soft delete writes
  `CURRENT_TIMESTAMP`, which isn't ISO text. No base service: the services are use cases, and a base one only forwards
  to the repository; the user picked it as the foundation.
- **Decision:** `BaseEntity` holds `id`, `sortId`, `updatedAt` and `deletedAt`, and every entity extends it.
  `IBaseRepository` and `makeBaseRepository` give `add`, `findById`, `findMany`, `update`, `upsert` and `softDelete`.
  Reads skip soft-deleted rows and follow `sortId`; `upsert` brings a soft-deleted row back; `update` writes only the
  columns it is given, so the extension and `aggregor-pty` never overwrite each other's. `base.service.ts` has the same
  six calls for any repository, which the entity services use instead of their repositories.
- **Why:** each new table is a Drizzle table, its generated migration, an entity and a few lines of repository.

### Rows are read through the entity's factory; entities don't know how they're stored (2026-11-07)

- **Problem:** stored rows carry NULLs and timestamps as text, not what the domain uses.
- **Options:** entities as Effect `Model.Class`es (tried and reverted the same day): one schema per table with insert
  and update variants, but the domain entity then knows how it is stored, such as which columns the database generates
  and that timestamps are text. A `Model.Class` row model per table in infrastructure beside each entity, which repeats
  the entity's fields for four small tables. Services calling the factory themselves, which hands rows to the
  application layer.
- **Decision:** entities are plain `Schema.Class`es with domain types. `BaseEntity.fromRow` turns NULL into an absent
  field and the ISO text of `updatedAt` and `deletedAt` into a `DateTime`, then decodes the row into the entity; the
  base repository passes every row it returns through it, and writes plain columns.
- **Why:** the domain stays storage-agnostic, services only ever receive entities, and the cleanup lives in one place. A
  `Model.Class` earns its place where the stored or wire shape is its own thing: a row model in infrastructure once a
  table's columns differ a lot from its entity, or the messages of an HTTP or socket API through its `json` variants.

### Every row has a `sortId` (2026-11-07)

- **Problem:** the user will move projects and sessions up and down, so rows need an order of their own, apart from when
  they were made.
- **Options:** SQLite's `AUTOINCREMENT`, which works only on an integer primary key, and the key is the UUID v7 `id`.
  Ordering by `updatedAt`, which every write changes.
- **Decision:** a `sortId INTEGER NOT NULL` base column. The base repository gives a written row the table's highest
  `sortId` plus one, in the statement that writes it; `upsert` does the same for the row it brings back, so an
  added-again project moves to the end. Reads list rows in `sortId` order. Moving a row is a `sortId` change, for when
  that feature comes.
- **Why:** a writing statement holds SQLite's write lock, so two windows never get the same `sortId`; soft-deleted rows
  keep theirs, so none is reused.

### Timestamps are stored as ISO 8601 text in UTC (2026-11-07)

- **Problem:** `updatedAt`, `deletedAt` and later timestamps need one stored format that the extension, `aggregor-pty`
  and a person reading the database all agree on.
- **Options:** milliseconds since the epoch as an integer: smaller, but unreadable in `sqlite3`.
- **Decision:** text such as `2026-11-07T22:13:46.836Z`: `DateTime.formatIso` in the extension, and SQLite's
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` in `aggregor-pty`, which give the same shape. Entities hold `DateTime.Utc`,
  parsed in `BaseEntity.fromRow`.
- **Why:** readable in the database, sorts in time order as text, and SQLite's date functions read it.

### One UUID v7 id per row (2026-11-07)

- **Problem:** every table was to carry an auto-increment `id`, a random `uuid` and `createdAt`.
- **Options:** all three columns, with relations on the integer id, which collides between databases.
- **Decision:** one `id` column holding a UUID v7, the `EntityIdValueObject` every entity's id is. Its factory service,
  `entityId.domainService.ts`, makes ids (`makeEntityId`, on Effect's `SecureRandom.uuidV7`) and reads their creation
  time (`getEntityIdCreatedAt`); ids sort by creation time as text. A session's id is also its agent's session id, so
  `SessionIdValueObject` folded into it. Claude Code accepts a UUID v7 for `--session-id` (checked 2026-11-07).
- **Why:** one column gives uniqueness, creation order and creation time, and stays unique across machines.

### Drizzle on Effect defines the tables, builds the queries and generates the migrations (2026-11-08)

- **Problem:** the tables must be created and later changed, and the user wanted Effect's ecosystem to do that work
  rather than hand-written SQL.
- **Options:** hand-written `CREATE TABLE`s, one file per table, with `PRAGMA user_version` dropping and creating them
  again on a mismatch (2026-11-07 to 2026-11-08). Effect's `Model.Class` with `SqlModel.makeRepository` behind our base
  repository: a Model knows no column types or constraints, so it can't create tables, Effect's `Migrator` runs
  hand-written migrations, every column would be declared three times (entity, Model, migration), and only `insert` and
  `findById` fit our base repository. The `@effect/sql-drizzle` and `@effect/sql-kysely` adapters, which need Effect 3.
  An `effect-orm` project, not evaluated.
- **Decision:** `drizzle-orm` 1.0.0-rc.5, pinned, through its own Effect 4 driver `drizzle-orm/effect-sqlite-node`,
  which runs on the same `@effect/sql-sqlite-node` client; `drizzle-kit` 1.0.0-rc.5 for development.
  - Each `infrastructure/database/models/<table>.model.ts` is a `sqliteTable` (`ProjectTableModel`...) spreading
    `BASE_COLUMNS` from `base.model.ts`.
  - `pnpm db:generate` (`drizzle-kit generate`, configured in `apps/extension/drizzle.config.ts`) writes the migrations
    into `apps/extension/assets/migrations/`, committed and shipped in the VSIX without drizzle-kit's snapshots. Before
    0.1.0 there is one: a schema change deletes the folder, runs `pnpm db:generate --name create_tables` and deletes the
    old database (2026-11-08; until then, a migration per change). From 0.1.0, a migration per change.
  - `DatabaseLayer` runs Drizzle's `migrate` when a window starts, in one `BEGIN IMMEDIATE` transaction so a second
    window starting at once sees the first one's migrations, with foreign keys off around it so a migration can rebuild
    a table.
  - The base repository builds its queries with Drizzle's builder; a repository passes a join for the columns it reads
    from another table (a session's `projectPath`), and `upsert` conflicts on the table's unique columns, read from the
    table.
- **Why:** each table is declared once, in TypeScript, and drizzle-kit derives its migrations, including SQLite's table
  rebuilds; queries still run through Effect's client and show in the trace. `aggregor-pty` writes plain SQL against the
  same tables. Costs: a release candidate; every query error is one `EffectDrizzleQueryError`, which the base repository
  maps to `DatabaseReadError` or `DatabaseWriteError`; generated SQL needs reading before it is committed; about 120 KB
  of bundle. drizzle-kit writes no `NOT NULL` on a text primary key, which SQLite then lets be NULL; every id comes from
  `makeEntityId`.

### Agents sit behind a harness interface (2026-11-03, #57)

- **Decision:** Claude Code's launch, status and title code lives in `ClaudeCodeHarnessInfraService`, behind
  `IHarnessInfraService`. Use cases reach a session's harness by its `harnessId`, and the terminal runs the launch plan
  the harness returns.
- **Why:** Gemini CLI, OpenCode and Codex (M4) become more harnesses, not changes to the use cases.

### "Project", not "repo" (2026-11-03, #60)

- **Decision:** "repository" means only a DDD repository or a git repository. Lint's abbreviation rule suggests
  "project" for "repo".

### Names say what a thing is to the user (2026-11-08)

- **Problem:** `IPromptInfraService` read like an LLM prompt, and `clickedProject` named the gesture, not the thing.
- **Options:** `activeProject` or `openedProject`: "active" and "opened" already describe the project shown in the
  window, and a session you remove or rename may be closed or idle. `selectedProject`: VS Code's tree selection, which
  an inline button doesn't change.
- **Decision:** `IUserInputPromptInfraService` (`userInputPrompt.infraService.ts`), whose `askForText` takes a
  `question`; "prompt" is kept for LLM prompts. `chosenProject` and `chosenSession` for what a command acts on, chosen
  from its row or the picker: `newSessionInChosenProject` (also the command ID), `openChosenSession`,
  `renameChosenSession`, `removeChosenSession` and `removeChosenProject`, with the raw argument named `projectRow` or
  `sessionRow`. `prepareColumns` became `replaceUndefinedWithNull`, and `writeRowLast` `writeRowAtEnd`. Lint's
  abbreviation rule suggests "chosen" for "clicked", and `AGENTS.md`'s naming rule says it.
- **Why:** a name a person reads without the code open should say what the thing is.

### No users before 0.1.0 (2026-10-31)

- **Decision:** rename command IDs, setting keys and storage keys, and change stored data, with no hand-written
  migrations or shims. drizzle-kit's generated schema migrations (2026-11-08) are kept, since they cost nothing.
- **Why:** until 0.1.0 the author is the only user. Sessions moved keys four times (`sessions`, `storedSessions`,
  `savedSessions`, `agentSessions`).

### Every function is a traced `Effect.fn` (2026-10-31 to 2026-11-05, #44, #45, #49)

- **Problem:** a crash inside a command was lost, and failed background work was swallowed silently.
- **Decision:** every command runs as a root span named by its command ID, and every function is an `Effect.fn`, so each
  call is a child span. Finished spans and Effect logs go to the Aggregor App output channel, which VS Code also writes
  to disk. Lint bans `Effect.gen` and `Effect.withSpan`. Tree items, badges and the spinner run untraced.
- **Why:** the trace shows what ran and what failed, and a test reads it from disk; per-row callbacks would flood it.

### Span names are `<owner>.<const>` (2026-11-04, #59)

- **Options:** a layer prefix such as `TerminalService.openSessionTerminal` (#47).
- **Decision:** the owner comes from the file name; `pnpm lint:fix` corrects the names.
- **Why:** one search for a trace line finds the code behind it.

### `Result`, never `Option`; no `?.` or `??` (2026-11-01, #49)

- **Decision:** a value that can be missing is a `Result`, or an effect that fails with a tagged error saying why. Lint
  bans `Option`, `?.` and `??`.
- **Why:** the reason a value is missing is kept, as in `viewedSessionId` failing with `NoViewedSessionError`.

### Errors are `Schema.TaggedError`s at the top of the file that raises them (2026-11-04 to 2026-11-05, #65)

- **Options:** an `errors/` folder per layer (#55), then an `.error.ts` beside its file.
- **Decision:** an interface's errors live in its `.interface.ts`, and every other error in the file that raises it.
  Lint bans `.error.ts` files, keeps errors above a file's code and checks the `Error` suffix.

### Every Effect diagnostic is an error (2026-11-05, #65)

- **Decision:** `@effect/tsgo` reports each Effect rule as an error in `pnpm typecheck` and the editor;
  `packages/tsconfigs/tsconfig.base.json` gives the reason for each one turned off.

### One import path per file (2026-11-05, #62)

- **Options:** a single `@/*` alias; relative imports.
- **Decision:** one alias per folder under each layer; lint rejects relative imports and `import * as`.
- **Why:** each file has one import path, and an import names what it takes.

### Small functions (2026-11-02, #50)

- **Decision:** lint caps a function at 30 lines. Helpers sit at module level and take their shared state as parameters;
  a layer's `make` only creates state, starts watchers and wires the service. Files have no length limit since
  2026-11-09 (ESLint's `max-lines` was 300), so an entity's use cases stay in one service.
- **Why:** each function does one job and shows up as its own span.

### Controllers decode VS Code arguments with a schema (2026-10-29, #32; 2026-11-03, #58)

- **Problem:** a tree view's title-bar action receives whichever row is focused. New Session from the title bar with a
  session row focused saved a session with no path, and every later read failed as corrupt.
- **Decision:** the title-bar New Session... asks for the project; every controller decodes its arguments with a schema,
  so a mismatch is logged and shown instead of reaching the service. Since 2026-11-09 the schema is the use case's
  request DTO, and a Sessions row passes its node id (`project:<path>`, `session:<id>`), which the controller decodes
  into that DTO.

### The backend drives the Sessions view (2026-11-08; DTOs and presenters since 2026-11-09)

- **Problem:** after step 3 the view still held the unread state, decided each row's status, merged five change sources
  itself, read the repositories and the terminal and harness services directly, and listed the statuses again
  (`RowStatus`, inline `done || idle || unknown` checks). Every change redrew the whole tree, and every window kept a
  copy of the sessions and projects.
- **Options:** a snapshot of every project and session, rebuilt and pushed on each change, which still redraws every
  row. Per-row queries with the view still merging the change sources and diffing badges. The first build of this
  (2026-11-08): the list's rows and changes as value objects (`ListedSessionValueObject`,
  `SessionListChangeValueObject`) built by a domain service, and a `sessionList.controller.ts` that worked out what kind
  of row it was given; but those have identity, so they are no value objects, and a controller only calls a service.
- **Decision:**
  - The backend sends what changed, not the data: `SessionListChangeDto` is `ProjectListChanged`,
    `ProjectSessionsChanged` (a session added or removed) or `SessionChanged` (any other write, or its tab opening or
    closing), and the view redraws only that: the whole tree, one project, or one row and its badge.
  - The tree's nodes are ids, `project:<path>` and `session:<id>`, since VS Code finds a node to redraw by its id. Each
    draw reads the node through the controllers: a `ProjectListItemDto`, or a `SessionListItemDto` with the status the
    user sees (`SessionStatusValueObject`, picked from the stored `AgentStatusValueObject` by `getSessionStatus`), its
    kind and progress only while the turn runs, its message unless the agent is gone, its icon path and its project's
    name. `SessionService` assembles it.
  - No window keeps a copy: every read is a query, and each repository's `entityChanges` reads only the rows written
    since its last check (see the `data_version` entry). The spinner reads the working sessions each frame while the
    view is visible.
- **Why:** one place decides what a row is, a status write redraws one row, and the data lives once, in the database.
  Text, symbols and colours stay the view's.

### Presentation talks to use cases in DTOs (2026-11-09)

- **Problem:** DDD.md said "there are no DTOs", so services took and returned entities and value objects, and the list's
  read models sat among the domain's value objects. Controllers did UI work (Source Control progress, a context key,
  re-running their own command), and presentation imported the domain, repositories and infrastructure.
- **Options:** keep passing domain objects across, as Fowler advises inside one process unless the presentation model
  and the domain model differ; they differ here (rows against entities). One request DTO per shape (`{sessionId}`)
  instead of one per use case.
- **Decision:**
  - Request and response DTOs live in `application/dtos/<x>.dto.ts` as schemas: `<UseCase>RequestDto`, one per use case,
    and response DTOs named for what they are (`SessionListItemDto`, `ProjectListItemDto`).
  - A controller decodes its input into the request DTO with `decodeVsCodeArgument` and calls one service; it imports
    only services, DTOs, presentation helpers and that decoder. Presenters import services' types; views import
    controllers and DTOs' types. Presentation imports nothing from the domain or infrastructure.
  - A value object is only a value: `LaunchPlan` went to the harness interface, the list's rows and changes to DTOs.
  - Source Control progress, its context key and the retry after Stage All moved into `CommitMessageService`, through a
    new `IProgressInfraService`; `scm.*` became `commitMessage.*`.
  - Every use case's file holds all of an entity's use cases, commands and queries; `sessionList.service.ts` went back
    into `session.service.ts`.
- **Why:** Evans and Martin keep the domain isolated and pass simple structures across boundaries; Vernon has the
  application service assemble DTOs. A use case's contract is then one schema, which the controller validates against.

### A command's failure is shown by its presenter (2026-11-09)

- **Problem:** services built and showed error messages, so the backend decided what the user reads.
- **Options:** a controller mapping its errors (a controller only calls a service); one message per error tag for every
  command, which can't tell a session's terminal from a project's. For work no command starts (title sync, viewedAt, the
  project switch): handing failures to presentation through a stream.
- **Decision:** a use case returns every failure the user should hear about as a typed error, and ends quietly on a
  cancelled pick or a row removed meanwhile. Each feature has a presenter (`presentation/presenters/<x>.presenter.ts`)
  whose type is every failure its services return, so a new failure fails to compile until it has a message; `routes.ts`
  registers each command with its presenter, and `registerCommand` logs the failure and shows the message. Work no
  command started logs its failures in the trace log.
- **Why:** the backend says what went wrong; presentation decides how to say it.

### `@pkg/vscode` holds what presentation and infrastructure share (2026-11-09)

- **Problem:** `VsCodeApi` and the vscode helpers sat in infrastructure, but views and the middleware need them too.
- **Decision:** a workspace package, `packages/vscode`: `VsCodeApi` (the one runtime `vscode` import),
  `acquireDisposable`, `fromEvent`, `setContext`, `withProgress`, `showErrorInBackground`, and `decodeVsCodeArgument`
  (formerly `decodeCommandArgument`). Lint applies the extension's code rules to it.
- **Why:** presentation imports nothing from infrastructure, and the shared code has one home.

### Constants are split by feature (2026-11-09)

- **Problem:** every constant went into `extension.constant.ts` or `message.constant.ts`.
- **Options:** by kind (ids, UI, runtime, messages).
- **Decision:** one `@pkg/constants/src/<feature>.constant.ts` per feature (app, commitMessage, database, git, harness,
  project, session, sessionsView, terminal, workspace), each with `<FEATURE>_COMMANDS`, `_LABELS` (titles, buttons,
  placeholders), `_NOTICES` (confirmations and offers) and `_ERRORS` (failure texts) as it needs them.
- **Why:** a feature's ids and words sit together, and a constant's file says who uses it.

## Dependencies and tooling

### Effect 4 (2026-09-08; 4.1 since 2026-10-29, #31)

- **Decision:** Effect for services, layers, typed errors, streams and tracing, on v4, whose API names differ from the
  v3 material online (`Result`, `Effect.result`, `Effect.catch`).
- **Why:** not recorded when it was added. It is what gives every function its span and every failure a typed error.

### `@effect/tsgo` on TypeScript 7 native (2026-09-08)

- **Decision:** `@effect/tsgo` patches the TypeScript 7 native compiler (`@typescript/native`), so Effect's rules run in
  `pnpm typecheck` and in the editor through `js/ts.experimental.useTsgo`.

### pnpm workspace with pinned Node and pnpm (2026-09-24)

- **Decision:** a pnpm monorepo (`apps/extension`, `packages/*`); `devEngines` pins Node 26 and pnpm 12 with
  `onFail: error`, and CI's `pnpm/setup` installs the versions it names.

### Vite bundles, vsce packages (2026-09-08)

- **Decision:** Vite builds the extension into one `dist/extension.js`; vsce packages it with `--no-dependencies`.
  Because it ships as one bundle, `presentation/` lives inside `src`.

### Rust for `aggregor-pty`, checked like the TypeScript (2026-11-08)

- **Decision:** edition 2024, the toolchain pinned to 1.99.1 in `apps/pty/rust-toolchain.toml`, `rustfmt.toml` at
  Prettier's 120 columns. `apps/pty` is a pnpm workspace package, so `pnpm pty:check` (`cargo fmt --check` and
  `cargo clippy -D warnings`) runs in `pnpm quality`, `pnpm pty:test` runs the tests, and the pre-commit hook runs
  `rustfmt --check` on staged `.rs` files. `.vscode/settings.json` points rust-analyzer at the crate. The extension's
  `build:pty` copies the host build to `apps/extension/bin/`, which `compile`, `package` and the `verify-in-vscode`
  skill run.
- **Why:** one command checks the whole repo, and the end-to-end test builds its database from the extension's
  migrations, so a schema change that breaks the binary fails its test.

### Lint and format on commit (2026-05-08)

- **Decision:** ESLint (typescript-eslint, unicorn, perfectionist, import-x, promise, e18e, markdown, json, package-json
  and the local `eslint.plugin.ts`) and Prettier, run on staged files by husky and lint-staged.
- **Gotcha:** lint-staged checks the index, so files moved with `git mv` and then edited must be re-staged before a
  commit.

### Renovate instead of Dependabot (2026-10-31, #36)

- **Problem:** Dependabot's npm runs failed: its container runs Node 24, and `devEngines` (Node 26, `onFail: error`)
  makes pnpm refuse to install.
- **Decision:** Renovate (`.github/renovate.json5`), which installs the Node that `devEngines` names. Weekly, minor and
  patch bumps in one PR, OSV vulnerability alerts, GitHub Actions in their own `ci` PR, and `vscode` with
  `@types/vscode` together.

### Updates wait 1 day after a release (2026-11-06, #75)

- **Options:** 7 days (#36), then 3 days (#41).
- **Decision:** Renovate proposes a release once it is 1 day old, for every manager; pnpm's `minimumReleaseAgeExclude`
  list is gone.
- **Why:** a compromised release has time to be pulled, and 1 day matches pnpm's own `minimumReleaseAge` default.

### Actions pinned to exact tags, with a lock file (2026-11-07, on `chore/add-gh-actions-lock`)

- **Options:** commit digests in the workflows, which Renovate pinned through `helpers:pinGitHubActionDigests`.
- **Decision:** workflows name exact tags (`actions/checkout@v7.0.1`), Renovate ignores the digest preset, and
  `gh actions-lock` writes each tag's commit SHA to `.github/workflows/actions.lock`.
- **Why:** the workflows stay readable while the lock file keeps the commit behind each tag.

### Commit messages come from a shell command (2026-10-08; model pinned 2026-10-26, #26)

- **Decision:** `aggregorApp.commitCommand` runs in the repository root with the staged diff on stdin and prints the
  message. The default runs `claude -p` on `claude-haiku-5-5` at low effort, with the prompt on one line and no double
  quotes so it runs the same under sh and cmd.exe.

### `bumpp` for version bumps (2026-11-02, #51)

- **Decision:** `pnpm bump` sets one version in the root and `apps/extension` `package.json` and pushes
  `chore/bump-v<version>`.

## CI and releases

### Releases start from merged PRs (2026-09-25, #6; 2026-11-02, #51)

- **Options:** creating a release from a pushed git tag (#4).
- **Decision:** `pnpm bump` opens a bump PR into dev; merging it opens the dev → main release PR; merging that publishes
  to the Marketplace and creates the GitHub release. Releases wait for the end of a milestone.

### Publish to the Marketplace with OIDC (2026-10-31, #39)

- **Options:** an Azure managed identity with `azure/login` (#13).
- **Decision:** `vsce publish --skip-duplicate --oidc`, through a Trusted Publishing policy on the `marketplace`
  environment. No `main` branch rule on that environment: `release.yaml` runs on `pull_request`, whose ref is
  `refs/pull/<n>/merge`, so the rule would block publishing.
- **Why:** no secrets and no Azure resources.

### Checks package the `.vsix` (2026-10-31, #34)

- **Problem:** vsce refuses to package when `@types/vscode` is newer than `engines.vscode`, which failed the v0.0.3
  release.
- **Decision:** Checks runs `vsix` on every branch. Renovate moves `vscode` and `@types/vscode` together with
  `rangeStrategy: bump`, and skips `vscode` patch releases, which add no API and would only lock users out.

### A VSIX per platform, built in CI (2026-11-08)

- **Problem:** the extension ships a native binary, so one VSIX can't serve every platform.
- **Options:** building each target on its own native runner. Cross-compiling macOS from Linux with Zig, which needs
  Apple's SDK for anything beyond libc.
- **Decision:** Release builds `x86_64` and `aarch64` musl binaries with cargo-zigbuild (0.24.1, Zig 0.17.1, in a venv
  on `PATH` so it finds Zig) on one Linux runner, and both macOS targets with cargo on one Apple silicon runner. The
  release job packages `linux-x64`, `linux-arm64`, `darwin-x64` and `darwin-arm64` with their binary and a universal
  VSIX without one, and publishes all five. Artifacts drop the executable bit, so packaging sets it again; a packaged
  binary keeps it through install. Checks packages the VSIX with the runner's own build.
- **Why:** static musl binaries run on any Linux, two runners cover four targets, and the Marketplace serves the
  universal VSIX to every other platform, Windows included. Without the binary, starting or reopening a session says why
  instead: reopen the folder in WSL on Windows, or that the platform isn't supported yet.

## VS Code and agent integration

### Projects and sessions live in SQLite (2026-11-07)

- **Problem:** `aggregor-pty` (phase 2, step 2) must write each session's status from outside VS Code, and the data has
  relations: a project has many sessions.
- **Options:** `globalState` (2026-10-09 to 2026-11-07): one JSON value per key, read-modify-written by every window,
  out of reach of other processes. A native SQLite module, which needs a build per Electron version.
- **Decision:** `~/.aggregor/data/aggregor.db` (`AGGREGOR_HOME` moves the Aggregor folder; see its entry), opened with
  `@effect/sql-sqlite-node` on Node's built-in `node:sqlite` (VS Code 1.145's Electron has Node 24.22 and SQLite
  3.53.4), in WAL mode with foreign keys on. The tables are `projects` and `sessions`, every name camelCase, defined and
  migrated through Drizzle (see its entry). Both SQL modules are unstable Effect APIs, allowed by name in
  `tsconfig.base.json`.
- **Why:** a file any process can write, real relations, and no native module to ship.

### `aggregor-pty` runs each agent and records its status (2026-11-08)

- **Problem:** status has to come from the agent's own OSC 7501 reports and titles, which only something sitting between
  the agent and its terminal can read, and VS Code's terminal API can't.
- **Options:** writing the pty layer ourselves on rustix: fewer and newer crates, but Unix only. One `agentTitle` column
  with the binary picking the title. Writing the database from the output thread, which a locked database would stall.
  Printing errors, which would land on the agent's screen.
- **Decision:** a Rust binary in `apps/pty`, on portable-pty 0.9 (last released February 2025, kept because it also does
  native Windows), rusqlite with bundled SQLite, base64, rustix for raw mode and window size, and signal-hook. It passes
  every byte through, answers `OSC 7501 ; ?` with the bare reply, checks reports against the spec's rules and limits,
  and writes the root record onto the session's row: `status`, `statusKind`, `statusMessage`, `statusProgress`,
  `statusChangedAt` (only when the state changes), `hasWorked`, `reportedTitle` and, from OSC 0/2, `terminalTitle`. It
  starts at `unknown`, `clear` and a full reset go back to `unknown`, and the agent's exit writes `exited`; reports with
  an `id` wait for step 8. A writer thread keeps the latest pending change and writes title changes at most every 500
  ms. The agent runs whatever happens to the database; errors go to `aggregor-pty.log` beside it, at most 10 lines a
  run. A session's terminal runs `aggregor-pty --database ‹path› --session ‹id› -- ‹agent command›`: the terminal infra
  service wraps the harness's launch plan, and `getDatabaseFilePath` gives it and the database layer the same path.
- **Why:** the reports carry what each agent knows, in one format. Two title columns leave step 4's title rule to the
  domain. Codex's title spinner changes about ten times a second, and from step 3 every write makes the window read the
  rows it changed.

### Windows see outside writes by polling `data_version`, and read only the rows written (2026-11-08)

- **Problem:** `aggregor-pty` and other windows write the database, and a window has to notice within a moment and know
  which rows changed, without keeping a copy to compare against.
- **Options:** re-reading when the window regains focus (2026-11-07 to 2026-11-08), which misses every status change
  while you look at the window. Watching the WAL file, which a checkpoint recreates and which doesn't exist before the
  first write. A socket from the binary, planned for later (phase 2, Agreed 17). Re-reading every row into a copy per
  window on each change (step 3's first build), which the view then diffed. A change counter column kept by a trigger:
  exact and immune to the clock, but a column and triggers on every table.
- **Decision:** each repository's change feed (`entityChange.utils.ts`) looks again when `PRAGMA data_version` moves,
  read every 250 ms, untraced, which only another connection's commit does, and right after each of the window's own
  writes. A look reads the rows whose `updatedAt` is at or after the latest one it read, soft-deleted ones too, skips
  those it already read unchanged at that same millisecond, and calls a row added when its `sortId` is above every one
  it saw, removed when it has `deletedAt`, else updated. It publishes each as an `EntityChange`; a failed look leaves
  the cursor where it was.
- **Why:** one small query per write, no copy of the data, and a status shows within a quarter second. A clock that
  steps back could hide a write until the row's next one; the counter column is the fix if that ever shows.

### Clicking a closed session resumes it (2026-10-08; `hasWorked` since 2026-11-08)

- **Options:** looking for Claude's transcript file (2026-10-08 to 2026-11-08), which only Claude has.
- **Decision:** once the session has reported `working` (`hasWorked`), its tab runs the agent's resume command
  (`claude --resume ‹id›`); before that it starts fresh under the session's id.
- **Why:** an agent has a conversation to resume once it has worked, and the flag is the same for every agent.

### Rows show the status on the session's row (2026-11-08)

- **Problem:** status has to come from every agent, including a turn the user interrupts.
- **Options:** Claude Code hooks passed with `--settings`, writing a word per session to a status file the extension
  watched (2026-10-09 to 2026-11-08, #24): Claude only, and no hook runs for an interrupted turn. On top of them, the
  interrupt settle (2026-11-06 to 2026-11-08, #71): a running session went idle once its terminal title had shown
  Claude's idle mark for 3 seconds, which a renamed tab broke.
- **Decision:** `aggregor-pty` runs every session's agent and writes its OSC 7501 reports onto the session's row. A row
  with no terminal in this window shows exited, so an agent that died without writing `exited` never looks alive; with
  one, `blocked`, `error`, `working` and `exited` show as themselves, `unknown` and `idle` show idle, and `done` shows
  finished until the user has seen it, then idle. Seen is stored: the extension writes `viewedAt` on a session as it
  comes into view and as it leaves, and `done` counts as unseen while `statusChangedAt` is after `viewedAt` and the
  session is out of view (`getSessionStatus`). `error` shows as error.
  - Unread was first an in-memory set per window (step 3's first build), lost on every extension restart, such as the
    first project switch. Writing `idle` over `done` instead would make the extension a second writer of
    `aggregor-pty`'s column, and `aggregor-pty` would have to stop rewriting a state that didn't change.
  - An agent that ends a turn with `idle` instead of `done` (OpenCode 2.2.5) shows no finished mark.
- **Why:** every agent that speaks OSC 7501 reports the same states, an interrupt included, and an agent that never
  reports (Copilot) sits at idle instead of looking stuck. Stored, a finished turn survives an extension restart and
  shows the same in every window, and each column keeps one writer.

### Each status has a row badge (2026-11-08)

- **Problem:** six row states need to be told apart at a glance.
- **Options:** codicons (`bell-dot`, `check`, `error`, `circle-outline`, `debug-stop`, as planned): a badge takes only
  up to two characters of text, codicon badges are a proposed API, and as the row's icon they would replace the agent's
  logo.
- **Decision:** the row's icon stays the agent's logo, and its badge, which also tints the label, is working's blue
  spinner, blocked's yellow `●`, done's green `✓`, error's red `✕` and exited's grey `○`; idle has none. A blocked row's
  label names its kind (needs permission, has a question, needs sign-in), the tooltip carries the agent's message, and
  progress shows as `42%` after the name.
- **Why:** the agent's logo tells sessions apart once there are five agents, and text badges are what the stable API
  draws.

### Session titles come from what the agent reports (2026-11-06, #69; from the row since 2026-11-08)

- **Options:** read Claude's transcript (the earlier build; Orca and cmux read OSC titles and the transcript); generate
  a title with an LLM, as T3 Code and Conductor do; read `Terminal.name` every second (2026-11-06 to 2026-11-08), since
  no change event exists.
- **Decision:** session terminals open without a name, so the tab shows the agent's OSC title. `aggregor-pty` stores the
  title from the agent's 7501 report and its OSC 0/2 title on the row, and `getSessionTitle` takes the first that holds
  a title: status marks (symbols, spaces and control characters) trimmed at both ends, and not empty, one of the
  harness's placeholder titles, or only an id (a UUID, maybe with a prefix such as `ses_`). The title becomes the
  session's `name`, so the row keeps it while the agent is gone or resuming; only that save is traced, since the check
  runs on every write to a session. Rename stores a `customName`, which wins in the row and the tab.
- **Why:** one rule covers every agent's title, and a harness adds only data. Dropping the agent's own name or the
  project folder from a title waits for step 4, which brings each harness's name.

### Aggregor keeps its files in one folder, `~/.aggregor` (2026-11-09)

- **Problem:** the database and `aggregor-pty`'s log sat at the top of `~/.aggregor`, and the anchor folder deep in VS
  Code's global storage, which each profile, and Insiders, has its own of: every profile got its own anchor and saved
  workspace while all of them shared one project list.
- **Options:** the anchor folder in global storage (2026-11-05 to 2026-11-09). The anchor folder straight under
  `~/.aggregor`, beside the database files. `~/.aggregor` itself as the anchor folder, which would make VS Code watch
  the database.
- **Decision:** `~/.aggregor` (or `$AGGREGOR_HOME`, which replaced `$AGGREGOR_DATA_DIR`) holds `data/` (`aggregor.db`,
  its WAL files and `aggregor-pty.log`) and `anchor/` (`Aggregor/`, the anchor folder, and the `saveOffered` marker).
  `getAggregorFolderPath` reads it, and `getDatabaseFilePath` and `getAnchorFolderPath` build on it. `VsCodeApi` no
  longer carries `globalStorageUri`. Nothing moves the old files: the first switch after the change finds folder 0 is
  not the new anchor folder and anchors the window again, restarting the extensions once and offering to save once.
- **Why:** one place to find everything Aggregor stores, and every profile opens the same Aggregor workspace. A second
  window, in any profile, now shares the anchor folder's settings, as a second window in one profile already did.

### One project in view, behind a hidden anchor folder (2026-11-05, #68)

- **Problem:** with every project a workspace folder, Explorer, search, file watching and Source Control span all of
  them, and git watches each repository recursively. Changing workspace folder 0 restarts every extension; only VS
  Code's own Agents window is exempt.
- **Options:** swap folder 0 on each switch, restarting every extension each time; an extension-owned anchor at
  folder 0.
- **Decision:** the first switch puts a hidden anchor folder (`~/.aggregor/anchor/Aggregor`) at folder 0 and the viewed
  session's project at folder 1; later switches swap only folder 1. That first switch restarts the extensions once.
  Session terminals carry `AGGREGOR_SESSION_ID` in their env, so they are found again after the restart, and the
  anchor's `terminal.integrated.cwd` makes New Terminal open in the shown project.
- **Why:** one restart instead of one per switch. TypeScript, ESLint, Prettier, rust-analyzer and Lua all follow the
  shown project; mise needs `mise.selectWorkspaceFolder` after each switch.

### One project list for every window (2026-11-08)

- **Problem:** the user works in one VS Code window that holds all their projects, so a list per window is machinery
  they don't use.
- **Options:** a list per window, by the window's key (2026-11-05 to 2026-11-08): a `windows` row per key and a
  `windowProjects` row per added project, plus an anchor folder per key; the key survived the switch to an untitled
  workspace, whose `workspaceState` starts empty. Before that, `workspaceState` (#27), which loses the list at that
  switch, and `globalState` under the window's key.
- **Decision:** the `projects` table is the list: `isAdded` (named `added` until 2026-11-09) marks a listed project, Add
  Project upserts it with `isAdded` (to the end of the list), and Remove Project clears it; its sessions stay and come
  back with it. A workspace folder's project gets a row with its first session without being added, so it stays one of
  the window's own folders. One anchor folder, `~/.aggregor/anchor/Aggregor`, with one save-offer marker. The windows
  tables went with a generated migration, which leaves every project unadded.
- **Why:** less to build and keep. Adding windows back is one table and a migration. Until step 6 runs agents in tmux, a
  second window shows the same sessions, and opening a running one there would start a second agent on its id.

### Listed projects are `ProjectListItemDto`s (2026-11-07; a DTO since 2026-11-09)

- **Problem:** a workspace folder is listed before its project has a row, so a listed project can't be the stored
  `ProjectEntity`.
- **Decision:** `ProjectService.listProjects` returns `ProjectListItemDto`s (path, name, isAdded), built from the
  workspace folders and the added projects; a project's row is made the first time it is added or given a session. Until
  2026-11-09 these were `ListedProjectValueObject`s, but a project identified by its path is no value object.

### Offer once to save the workspace as Aggregor (2026-11-06, #68)

- **Problem:** an unsaved multi-root workspace is named Untitled and asks to be saved when the window closes, and no API
  saves one silently.
- **Decision:** after the first switch, offer once to save it. The anchor folder is named `Aggregor`, so the dialog
  suggests `Aggregor.code-workspace` and the window takes that name.

### Wait for the git extension before reading its API (2026-11-01, #47)

- **Problem:** the git extension may not be active yet when aggregor reads its exports.
- **Decision:** call its `activate()` and use what it returns.
