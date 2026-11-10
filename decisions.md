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

### PR titles are commit subjects with a feature scope, plus the stack's step (2026-11-10, on `chore/bump-deps`)

- **Problem:** `gh pr create --fill` takes the commit's subject as the title only when the PR opens with one commit;
  with more it falls back to the branch name (#77 was `stack/harness foundation/1/feat/sqlite storage`). Scopes varied
  (`feat(extension)!:` next to `feat!:`), a stack PR's title didn't say its stack or step, and nothing checked the
  format, though each PR title goes into its merge commit.
- **Options:** titles built from the branch name (`feat(harness-foundation): sqlite storage`), consistent but with terse
  slugs; no stack in the title, since the branch name and GitHub's stack view show it. For scopes: none at all (briefly
  the choice), which drops what a title can say; one per package (`extension`, `pty`, `eslint`, ...), which needs no
  list but says `extension` on most commits; one per DDD layer, which most features cut across.
- **Decision:** Auto PR titles each PR with its first commit's subject (`--fill-first`), and a stack PR adds
  `[<name> <n>]`: `feat(storage): keep sessions in SQLite [harness-foundation 1]`. A title is
  `<type>(<scope>): <subject>`, with `!` before the colon for a breaking change, and the scope is required: a feature
  (`sessions`, `projects`, `agents`, `status`, `alerts`, `workspace`, `commit-message`, `storage`), or `lint`, `deps`,
  `release`, or `repo` for anything no feature covers. The PR Title workflow fails any other title on a PR into anything
  but `main`, whose release PR is titled `v<version>`. The default commit prompt stays generic, with an optional scope
  for any repository; `.vscode/settings.json` overrides `aggregorApp.commitCommand` with the same prompt and aggregor's
  scopes, each with what it covers. Renovate writes `build(deps):` and `ci(deps):`, `bumpp` `chore(release):`. A PR that
  adds a feature no scope covers adds its scope to both lists.
- **Why:** one title format from every source; a feature scope says what a change is about, and each stack PR's place
  shows in the PR list.

### Conventions are enforced by lint, not prose (2026-11-03)

- **Problem:** rules written only in AGENTS.md or DDD.md get skipped.
- **Decision:** each agreed convention gets an ESLint rule in the same PR: `no-restricted-syntax` selectors,
  `@typescript-eslint/naming-convention` per file glob, `no-restricted-imports` regexes, and the local rules in
  `packages/eslint/src/rules/`. When no installed rule can check it, write a selector rather than add a plugin.
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
  DDD.md has the details; `packages/eslint/src/layers/` checks imports and names.
- **Why:** a use case never depends on VS Code or on one agent.

### A base entity, a base repository and a base service (2026-11-07)

- **Problem:** with related tables, every repository would repeat the same reads, writes and soft deletes, and every
  entity the same id and timestamps.
- **Options:** Effect's `SqlModel.makeRepository`: its reads are `select *`, so a row can't carry what it reads through
  a join (a session's project path); its update writes the whole row outside a transaction; its soft delete writes
  `CURRENT_TIMESTAMP`, which isn't ISO text. No base service: the services are use cases, and a base one only forwards
  to the repository; the user picked it as the foundation.
- **Decision:** `BaseEntity` holds `id`, `sortId`, `updatedAt` and `deletedAt`, and every entity stored in the database
  extends it (`AgentEntity`, which lives in the settings, does not). `IBaseRepository` and `makeBaseRepository` give
  `add`, `findById`, `findMany`, `update`, `upsert` and `softDelete`. Reads skip soft-deleted rows and follow `sortId`;
  `upsert` brings a soft-deleted row back; `update` writes only the columns it is given, so the extension and
  `aggregor-pty` never overwrite each other's. `base.service.ts` has the same six calls for any repository, which the
  entity services use instead of their repositories.
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
  added-again project moves to the end. Reads list rows in `sortId` order. Moving a row places it, and the rows after
  its new place, after every other row (see "Projects and sessions move up and down").
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

### Agents are settings entries (2026-11-03, #57; settings since 2026-11-09)

- **Problem:** each agent was code: Claude Code's launch plan, placeholder titles and icon sat in
  `ClaudeCodeAgentInfraService`, behind `IAgentInfraService` and a `LayerMap` keyed by agent id, so supporting another
  CLI meant a new infra service.
- **Options:** the agent interface (2026-11-03 to 2026-11-09). An agent as a value object, kept in a map keyed by agent
  id inside `ISettingsConfig`: smaller, but the identity lives outside the object. Merging the built-ins with the user's
  entries ourselves, which VS Code turned out to do already. Four flat settings, `aggregorApp.agents.commands`,
  `.resumeCommands`, `.names` and `.icons`, from agent key to a command line or text (tried on 2026-11-09): the Settings
  editor edits those in place, where it sends the nested setting to settings.json, but four tables for one thing
  cluttered Aggregor's settings.
- **Decision:**
  - An agent is `AgentEntity`, identified by its settings key (`AgentIdValueObject`, a branded string), and read through
    `IAgentRepository` (`findAll`, `findById`). It is no `BaseEntity`, since it isn't a row.
  - `aggregorApp.agents` holds one entry per agent key, `{name, command, args, resumeArgs, env, icon}`, edited in
    settings.json. Every field is optional: `command` and `name` default to the key, `args` to none, `resumeArgs` to
    `args`, `env` to none and `icon` to Aggregor's logo. `args` and `resumeArgs` take two variables: `${sessionId}`, and
    `${agentSessionId}` (see "Codex resumes its own conversation by id"). The setting has `machine` scope, so only user
    settings define commands, and its default holds the built-ins (`claude`, `codex`, `agy`, `opencode`, `copilot`),
    which VS Code merges with the user's entries field by field, `env` name by name; `null` hides one. An entry that
    doesn't decode, a variable name that isn't a POSIX name included, is left out with a warning, read once at start and
    again on each change of the setting.
  - `env` (added 2026-11-09) holds the variables the agent starts with, passed as tmux `new-session -e NAME=value`.
    Claude's default is `CLAUDE_CODE_TMUX_TRUECOLOR=1`: Claude drops to 256 colours whenever `TMUX` is set unless it is
    set, though Aggregor's tmux passes 24-bit colour. An agent added later that dims its colours in tmux gets its own
    switch the same way. A setting rather than a line in `tmux.conf`, so each agent's switches sit in its own entry and
    the user can add their own; hiding `TMUX` from every agent was rejected, since agents rely on it for clipboard,
    images and keys.
  - The domain's `prepareLaunchPlan(agent, session)` takes `resumeArgs` once the session has worked, else `args`, fills
    in the variables and returns a `LaunchPlanValueObject`, which the session's tab runs under `aggregor-pty`.
  - A session whose agent is gone shows a warning icon, and opening it fails with `AgentNotFoundError`.
  - An icon is the path of an SVG or PNG image (an entry naming another file is left out), relative ones inside the
    extension; codicons were dropped on 2026-11-10, so every agent shows a logo, in its rows, tabs, picker and desktop
    notifications alike. `assets/agents/` holds Claude Code's logo, OpenCode's and Copilot's (simple-icons 16.30.0, CC0,
    in OpenCode's grey `#8B929C`), Codex's and Antigravity's app icons (lobe-icons 1.102.0, MIT; Codex's without its
    white tile, which stood out on a dark theme), and Aggregor's logo in the same grey, which an entry without an icon
    shows. Codicons for Codex (`code`), Antigravity (`rocket`) and Copilot (`copilot`) came first.
- **Why:** another CLI is one settings entry, and the rules about launching and titles are the domain's, the same for
  every agent.

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

### A type sits below what it is built from (2026-11-09)

- **Problem:** lint kept every type at the top of its file, so `AgentListItemDto = typeof AgentListItemDtoSchema.Type`
  sat above the schema it comes from, and an error union above its errors.
- **Options:** dropping the rule, which lets standalone types scatter; an esquery selector, which can't tell what a type
  refers to.
- **Decision:** `aggregor/type-placement` in `packages/eslint/src/rules/`, for every TypeScript file: a type built from
  a value of its own file (a schema, an error class, a function), directly or through another such type, sits below the
  last of them; a type that stands alone stays at the top, after the imports. It replaced the `no-restricted-syntax`
  selector for types, and `perfectionist/sort-modules` now splits its sorting at blank lines, so such a type can follow
  the classes it names.
- **Why:** a file reads top down, each name defined before what is built from it.

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
  itself, read the repositories and the terminal and agent services directly, and listed the statuses again
  (`RowStatus`, inline `done || idle || unknown` checks). Every change redrew the whole tree, and every window kept a
  copy of the sessions and projects.
- **Options:** a snapshot of every project and session, rebuilt and pushed on each change, which still redraws every
  row. Per-row queries with the view still merging the change sources and diffing badges. The first build of this
  (2026-11-08): the list's rows and changes as value objects (`ListedSessionValueObject`,
  `SessionListChangeValueObject`) built by a domain service, and a `sessionList.controller.ts` that worked out what kind
  of row it was given; but those have identity, so they are no value objects, and a controller only calls a service.
- **Decision:**
  - The backend sends what changed, not the data: `SessionListChangeDto` is `ProjectListChanged`,
    `ProjectSessionsChanged` (a session placed, that is added or moved, or removed) or `SessionChanged` (any other
    write, or its tab opening or closing), and the view redraws only that: the whole tree, one project, or one row and
    its badge.
  - The tree's nodes are ids, `project:<path>` and `session:<id>`, since VS Code finds a node to redraw by its id. Each
    draw reads the node through the controllers: a `ProjectListItemDto`, or a `SessionListItemDto` with the status the
    user sees (`SessionStatusValueObject`, picked from the stored `AgentStatusValueObject` by `getSessionStatus`), its
    kind and progress only while the turn runs, its message unless the agent is gone, its agent's icon and its project's
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
  - A value object is only a value: the list's rows and changes became DTOs.
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
  registers each command with its presenter, and `registerCommand` logs the failure and shows the message. A presenter
  may also name the setting that fixes the failure (`aggregorApp.agents` for a missing agent), and the message then has
  an **Open Settings** button. Work no command started logs its failures in the trace log.
- **Why:** the backend says what went wrong; presentation decides how to say it.

### `@pkg/vscode` holds what presentation and infrastructure share (2026-11-09)

- **Problem:** `VsCodeApi` and the vscode helpers sat in infrastructure, but views and the middleware need them too.
- **Decision:** a workspace package, `packages/vscode`: `VsCodeApi` (the one runtime `vscode` import),
  `acquireScopedDisposable`, `streamVsCodeEvent`, `setWhenClauseContextKey`, `runWithProgressIndicator`,
  `openAggregorSettingsInSettingsEditor`, `showErrorNotificationWithoutWaiting`, and `decodeVsCodeArgument` (formerly
  `decodeCommandArgument`). Lint applies the extension's code rules to it. The helpers were `acquireDisposable`,
  `fromEvent`, `setContext`, `withProgress`, `openSetting` and `showErrorInBackground` until 2026-11-09, which named the
  gesture rather than what each one does.
- **Why:** presentation imports nothing from infrastructure, and the shared code has one home.

### Constants live in `@pkg/constants`, split by feature (2026-11-09; every constant since 2026-11-10, #98)

- **Problem:** every constant went into `extension.constant.ts` or `message.constant.ts`. Later, file names, timings,
  environment variables, external commands and VS Code's ids sat as loose constants or bare literals in the files that
  used them, so the database's folder name lived in a helper and the tmux socket's in another.
- **Options:** by kind (ids, UI, runtime, messages). Only ids and texts in `@pkg/constants` (2026-11-09 to 2026-11-10),
  the rest beside its code. Letting the domain import `@pkg/constants` for its title patterns, which would tie the
  domain to a package presentation and infrastructure share.
- **Decision:** one `@pkg/constants/src/<feature>.constant.ts` per feature (app, commitMessage, database, git, agent,
  process, project, session, sessionAlert, sessionsView, terminal, tmux, vscode, workspace), each with
  `<FEATURE>_COMMANDS`, `_LABELS` (titles, buttons, placeholders), `_NOTICES` (confirmations and offers) and `_ERRORS`
  (failure texts) as it needs them, and every other constant outside the domain: file and folder names, environment
  variables, external commands, VS Code's and other extensions' ids, timings, modes and patterns. Constants that
  describe one thing share an object with a label per value: `AGGREGOR_FOLDER`, `DATABASE_FILE`, `TMUX`,
  `AGENT_START_WAIT`, `SESSIONS_VIEW`, `ROW_ICONS`, `SELECT_ROW_RETRY`, `DESKTOP_NOTIFICATION`, `DESKTOP_NOTIFIERS`,
  `GIT_EXTENSION`, `AGENT_ICON`, `COMMAND_SEARCH`, `AGGREGOR_WORKSPACE`, `ANCHOR_FOLDER_SETTINGS`, `SESSION_TO_REOPEN`.
  `vscode.constant.ts` holds VS Code's own command ids, which several features run. The domain's patterns stay beside
  its rules, since the domain imports only `effect` and itself; a model's `BASE_COLUMNS` and the session repository's
  join are code. Log messages and a command line's arguments stay in their code. `aggregor/constant-placement` flags a
  module-level const named in UPPER_CASE, or set to a bare literal, in the extension outside the domain and models, and
  in `@pkg/vscode`. `drizzle.config.ts` reads `MIGRATIONS_FOLDER`.
- **Why:** a feature's ids, words and settings sit together, a constant's file says who uses it, and one change to a
  name or a timing touches one line.

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

### Every dependency version lives once, in the pnpm catalog (2026-11-09)

- **Problem:** each `package.json` pinned its own versions, so `effect`, `@types/node` and the like were pinned in two
  places that could drift apart.
- **Options:** named catalogs, which would let one workspace keep its own version of a package.
- **Decision:** as in chatly-web: every version sits once in `pnpm-workspace.yaml`'s `catalog:`, and each `package.json`
  names it as `"catalog:"` (workspace packages stay `workspace:*`). `catalogMode: strict` makes `pnpm add` write the
  catalog entry and refuse a different version; `cleanupUnusedCatalogs` drops entries nothing uses. ESLint
  (`eslint-plugin-pnpm` 1.9.1) fails a plain version (`pnpm/json-enforce-catalog`, which `lint:fix` moves into the
  catalog), one that conflicts with the catalog, a `catalog:` with no entry, and an unused or duplicate entry.
  `@types/vscode` is the one exception and stays a version in `apps/extension` and `packages/vscode`: vsce reads it to
  check `engines.vscode` and fails on `catalog:`. Declaring it only in `@pkg/vscode`, with the extension taking its
  types through that package, was tried and dropped, since vsce then skips the check. Renovate updates the catalog
  itself.
- **Why:** one source of truth for every version, which lint keeps that way.

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

### The ESLint setup lives in `@pkg/eslint` (2026-11-09)

- **Problem:** `eslint.config.ts`, `eslint.layers.ts` and `eslint.plugin.ts` at the root had grown to about 900 lines.
- **Options:** moving only the layering and the plugin, and keeping the base setup at the root; one file per category
  (base, layers, rules) instead of one per concern.
- **Decision:** a workspace package, `packages/eslint`: `src/base/` the setup per file type (TypeScript, JSON, Markdown,
  `package.json` with the pnpm catalog, ignores), `src/layers/` the DDD layering (import allow-lists, syntax bans, role
  names, and the per-folder configs that combine them), `src/rules/` the aggregor plugin, one file per rule, and
  `src/eslint.config.ts`, which composes them. The root `eslint.config.ts`, where ESLint looks, only re-exports it. The
  lint plugins are the package's dependencies; the root keeps `eslint` for its scripts. `tsconfigRootDir` is set to the
  repo root, since typescript-eslint would otherwise look for tsconfigs no higher than the package's `src`.
- **Why:** each concern has its own small file, and the root holds only what tools require there.

### Lint and format on commit (2026-05-08)

- **Decision:** ESLint (typescript-eslint, unicorn, perfectionist, import-x, promise, e18e, markdown, json, package-json
  and the local aggregor plugin) and Prettier, run on staged files by husky and lint-staged.
- **Gotcha:** lint-staged checks the index, so files moved with `git mv` and then edited must be re-staged before a
  commit.

### Renovate instead of Dependabot (2026-10-31, #36)

- **Problem:** Dependabot's npm runs failed: its container runs Node 24, and `devEngines` (Node 26, `onFail: error`)
  makes pnpm refuse to install.
- **Decision:** Renovate (`.github/renovate.json5`), which installs the Node that `devEngines` names. Weekly, minor and
  patch bumps in one PR, OSV vulnerability alerts, GitHub Actions in their own `ci` PR, and `vscode` with
  `@types/vscode` together. husky and portable-pty are left out of the abandoned-package warning (2026-11-10): both are
  kept on purpose despite no recent release.

### Updates wait 1 day after a release (2026-11-06, #75)

- **Options:** 7 days (#36), then 3 days (#41).
- **Decision:** Renovate proposes a release once it is 1 day old, for every manager; pnpm's `minimumReleaseAgeExclude`
  list is gone.
- **Why:** a compromised release has time to be pulled, and 1 day matches pnpm's own `minimumReleaseAge` default.

### Drizzle updates only to its releases (2026-11-10)

- **Problem:** drizzle publishes a build of each branch commit as `<version>-<hash>`, which semver ranks above the
  release itself. Renovate (#89) moved drizzle-orm and drizzle-kit from `1.0.0-rc.5` to `1.0.0-rc.5-ab785fc`, a build
  from 2026-08-11 whose types fail typecheck with `anyUnknownInErrorContext` and which pulled in esbuild.
- **Decision:** both stay on `1.0.0-rc.5`, and a Renovate rule skips any drizzle version ending in `-<7-char hash>`
  (`allowedVersions: "!/-[0-9a-f]{7}$/"`). esbuild's `allowBuilds` entry (#91) goes with it, since nothing installs
  esbuild any more.

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

### A VSIX per platform, built in CI, and no universal one (2026-11-08; no universal VSIX since 2026-11-10)

- **Problem:** the extension ships a native binary, so one VSIX can't serve every platform. v0.0.7 also published a
  universal VSIX without the binary, and the Marketplace makes each upload live minutes after `vsce publish`, in no set
  order: the universal one went live before `linux-x64`, a Linux VS Code auto-updated to it in between, and VS Code
  never swaps an installed universal build for a platform build of the same version, so no session could start until a
  reinstall.
- **Options:** building each target on its own native runner. Cross-compiling macOS from Linux with Zig, which needs
  Apple's SDK for anything beyond libc. A universal VSIX without the binary for every other platform, published with the
  rest (the race above) or last: the upload order doesn't set the order they go live, since `darwin-x64`, uploaded after
  it, went live first. Publishing it once the Marketplace lists every platform build, by polling: still a bet on timing,
  for a fallback that only reaches platforms where sessions can't run.
- **Decision:** Release builds `x86_64` and `aarch64` musl binaries with cargo-zigbuild (0.24.1, Zig 0.17.1, in a venv
  on `PATH` so it finds Zig) on one Linux runner, and both macOS targets with cargo on one Apple silicon runner. The
  release job packages `linux-x64`, `linux-arm64`, `alpine-x64`, `alpine-arm64`, `darwin-x64` and `darwin-arm64` with
  their binary, `win32-x64` and `win32-arm64` without one, and no universal VSIX. Artifacts drop the executable bit, so
  packaging sets it again; a packaged binary keeps it through install. Checks packages the VSIX with the runner's own
  build.
- **Why:** each platform matches only its own VSIX, so a client that updates mid-release gets its build or nothing new.
  Static musl binaries run on any Linux, Alpine included, so two runners cover the six targets with a binary. Windows
  still installs the extension, and starting or reopening a session there says to reopen the folder in WSL, which runs
  the Linux VSIX. `linux-armhf` gets no VSIX.

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
  `statusChangedAt` (only when the state changes), `hasWorked`, `reportedTitle` and, from OSC 0/2, `terminalTitle`, and
  `agentSessionId` when that title is a bare UUID (see "Codex resumes its own conversation by id"). It starts at
  `unknown`, `clear` and a full reset go back to `unknown`, and the agent's exit writes `exited`; reports with an `id`
  wait for step 8. A writer thread keeps the latest pending change and writes title changes at most every 500 ms. The
  agent runs whatever happens to the database; errors go to `aggregor-pty.log` beside it, at most 10 lines a run. A
  session's tmux session runs `aggregor-pty --database ‹path› --session ‹id› -- ‹agent command›`: the tmux infra service
  wraps the agent's launch plan, and `getDatabaseFilePath` gives it and the database layer the same path.
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
  those it already read unchanged at that same millisecond, and calls a row placed when its `sortId` is above every one
  it saw (new, or moved; `added` until 2026-11-10), removed when it has `deletedAt`, else updated. It publishes each as
  an `EntityChange`, whose kind is `EntityChangeKindValueObject` (`ENTITY_CHANGE_KINDS`); a failed look leaves the
  cursor where it was.
- **Why:** one small query per write, no copy of the data, and a status shows within a quarter second. A clock that
  steps back could hide a write until the row's next one; the counter column is the fix if that ever shows.

### Clicking a closed session resumes it (2026-10-08; `hasWorked` since 2026-11-08)

- **Options:** looking for Claude's transcript file (2026-10-08 to 2026-11-08), which only Claude has. `aggregor-pty`
  reading `hasWorked` as it starts and picking between the two argument lists it was given (2026-11-09), while VS Code
  restored session tabs after a quit by re-running the command they were opened with, which the extension never saw;
  since session tabs are transient, every tab is opened by the extension, so the pick went back to it.
- **Decision:** when tmux no longer runs the session's agent, opening it starts the agent again: the domain's
  `prepareLaunchPlan` takes the agent's `resumeArgs` (`claude --resume ‹id›`) once the session has reported `working`,
  else its `args`, which start fresh under the session's id where the agent takes one. While tmux still runs it, opening
  only attaches.
- **Why:** an agent has a conversation to resume once it has worked, and the flag is the same for every agent.

### Rows show the status on the session's row (2026-11-08)

- **Problem:** status has to come from every agent, including a turn the user interrupts.
- **Options:** Claude Code hooks passed with `--settings`, writing a word per session to a status file the extension
  watched (2026-10-09 to 2026-11-08, #24): Claude only, and no hook runs for an interrupted turn. On top of them, the
  interrupt settle (2026-11-06 to 2026-11-08, #71): a running session went idle once its terminal title had shown
  Claude's idle mark for 3 seconds, which a renamed tab broke.
- **Decision:** `aggregor-pty` runs every session's agent and writes its OSC 7501 reports onto the session's row. A row
  whose agent tmux no longer runs shows exited, so an agent that died without writing `exited`, as at a reboot, never
  looks alive (a row with no tab in this window counted as exited until 2026-11-09); otherwise `blocked`, `error`,
  `working` and `exited` show as themselves, `unknown` and `idle` show idle, and `done` shows finished until the user
  has seen it, then idle. Seen is stored: the extension writes `viewedAt` on a session as it comes into view and as it
  leaves, and `done` counts as unseen while `statusChangedAt` is after `viewedAt` and the session is out of view
  (`getSessionStatus`). `error` shows as error.
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
- **Decision:** `aggregor-pty` stores the title from the agent's 7501 report and its OSC 0/2 title on the row, and
  `getSessionTitle` takes the first that holds a title: status marks (symbols, spaces and control characters) trimmed at
  both ends, the agent's name, its command or the project folder dropped where joined by `-`, `|` or `:` at either end,
  and not empty, one of those names alone, only an id (a UUID, maybe with a prefix such as `ses_`), or a start time
  (OpenCode's `New session - 2026-11-09T09:26:37.754Z`). The title becomes the session's `name`, so the row keeps it
  while the agent is gone or resuming; only that save is traced, since the check runs on every write to a session.
  Rename stores a `customName`, which wins in the row and the tab.
- **Why:** one rule covers every agent's title, and an agent adds no title code.

### The session in front stays selected in the Sessions view (2026-11-09)

- **Problem:** the view selected a session when its terminal became active, which failed for a new session (its row is
  drawn a moment after its tab opens, so the warning "Could not select the active session" was logged and nothing was
  selected), and any click elsewhere in the view moved the selection off it.
- **Options:** selecting from the tree's own refresh, which the API gives no event for. Snapping back only from project
  rows, which still leaves a click on empty space.
- **Decision:** the row of the session whose tab is in front (`viewedSessionId`) is selected whenever that session
  changes, the user selects a project row or nothing, or the view comes into sight. Selecting a session row is left
  alone, since its click opens that session and brings it to the front: putting the old row back first made the
  selection jump between the two; a reveal that misses a row not yet drawn is retried every 250 ms, up to 8 times. With
  no session's tab in front, the selection is left alone. Arrow keys move the tree's focus, not its selection, so
  keyboard navigation still works, and Enter opens the focused session.
- **Why:** the highlighted row always says which session the editor shows, like Explorer for the active file.

### Projects and sessions move up and down (2026-11-10)

- **Problem:** the Sessions view listed projects in the order they were added and sessions in the order they started,
  and the user wants to arrange both.
- **Options:**
  - Gestures: drag and drop only, which the keyboard and screen readers can't reach; Move Up and Move Down only; inline
    arrow buttons, beside the two buttons rows already have.
  - Storage: a `position` column, whose moves would arrive as plain updates, which redraw only the moved session's row,
    and the change feed can't tell a move from another update without keeping a copy of the rows. Swapping two rows'
    `sortId`s, for the same reason.
  - The drop: always before the row dropped on, with a drop on the project row moving a session to the end.
  - The drop through a hidden command, for the command's root span and presenter; the view calls a controller directly,
    as it does for its reads.
  - Showing Move Up and Move Down on every row, doing nothing at an end; the flags come from the order the services read
    anyway.
- **Decision:**
  - Drag and drop, and Move Up and Move Down in each row's … menu. A session moves among its project's sessions, an
    added project among the added projects; the window's own folders stay first and don't move.
  - A dropped row takes the place of the row it is dropped on: after it when moving down, before it when moving up. Any
    other drop does nothing: on another project's session, a session on a project, a project on a session.
  - A move places the rows from the first place that changes on, in their new order, after every other row of the table:
    the base repository's `placeAtEnd`, one `UPDATE` that reads the highest `sortId` once. `findEntityIdsToPlaceAtEnd`
    in `sortOrder.domainService.ts` works those rows out.
  - The change feed reads those rows as placed, as it reads a new row, so every window, this one included, reads the
    project's sessions or the project list again. The kind `added` became `placed`, an `EntityChangeKindValueObject`
    with `ENTITY_CHANGE_KINDS`, since a moved row was never added; lint bans comparing with the kind strings.
  - `ProjectListItemDto` and `SessionListItemDto` carry `canMoveUp` and `canMoveDown`, from the row's place in the order
    (`canMoveUpInOrder`, `canMoveDownInOrder`); each row's context value lists them after its kind
    (`session canMoveUp`), and the menus show Move Up and Move Down only where they move. Each add, remove or move
    already reads the whole list again, so the flags stay right.
  - The view's `handleDrag` keeps the dragged row's node id under the tree's own drag type, and `handleDrop` hands both
    node ids to the project or session controller. A drag and a drop are root spans (`SessionsView.keepDraggedNodeId`,
    `SessionsView.moveDroppedRow`), and a failed drop is logged.
- **Why:** dragging is the quick way and the menu the one the keyboard reaches, and both run one service per kind. The
  order lives in the column every read already sorts by, and the change feed needs nothing new to redraw a move.
- **Limits:** VS Code drops onto a row, never between two, and gives keyboard users no drag; Move Up and Move Down cover
  them. No keybinding: a keybinding gets no row, so it would move the session in front.

### Every session's agent runs in tmux (2026-11-09)

- **Problem:** a session's agent ran as its tab's process, so a window reload, quitting VS Code or closing the tab ended
  it, and the tabs were transient, so a reload closed them.
- **Options:**
  - The extension starting each agent from a hidden, transient VS Code terminal running `tmux new-session -d …`, with
    the tab only attaching (built and tried on 2026-11-09): the agent started with no tmux client attached, and tmux
    answers an agent's OSC 10/11 colour queries only through an attached client, so agents that ask for the background
    as they start (Codex, OpenCode, Copilot, Claude) picked palettes that didn't match the theme. Each start also waited
    about 400 ms for the hidden terminal's exit, polled.
  - The extension starting tmux as its own child process: the agent would inherit the extension host's environment,
    without what VS Code gives terminals (the git extension's `GIT_ASKPASS` and `VSCODE_GIT_IPC_HANDLE`, which another
    extension can't read) and with VS Code's internals (`ELECTRON_RUN_AS_NODE=1`).
  - One tmux client for every tab, through tmux control mode (`-CC`), with the extension drawing each tab as a
    Pseudoterminal: one process instead of a small tmux client (about 1.4 MB) per open tab, but all agent output would
    pass through the extension host, and tabs would no longer survive a reload by themselves.
  - One-click tmux install through a terminal running the system's package manager: held back for now.
- **Decision:**
  - Each session's agent runs under `aggregor-pty` in a tmux session named by the session's id, on Aggregor's own tmux
    server, whose socket is `tmux.sock` in the Aggregor folder (`-S`), apart from the user's tmux; a test's
    `AGGREGOR_HOME` gets a server of its own. `assets/tmux.conf` replaces `~/.tmux.conf`: no prefix or status bar, mouse
    on, `escape-time 0`, `focus-events`, `extended-keys`, a 50,000-line history, `window-size latest`,
    `aggressive-resize`, 24-bit colour and OSC 52, and `update-environment` for VS Code's terminal variables and the
    session's `AGGREGOR_SESSION_ID`. A window sources it again when tmux already runs. tmux 3.2 or newer is required.
  - A session's tab runs tmux itself, with no shell:
    `tmux -S ‹socket› -f ‹conf› -u new-session -A -s ‹id› -c ‹project› -- aggregor-pty --database ‹db› --session ‹id› -- ‹command› ‹args›`.
    `-A` attaches when the session's tmux session runs and starts it otherwise, so the tab is attached from the agent's
    first byte, tmux answers its colour queries, and the agent gets the tab's own environment.
  - The tab is transient (since 2026-11-09): a reload or a quit closes it, which only detaches, and clicking the session
    attaches a new one. A tab is matched to its session by `AGGREGOR_SESSION_ID` in its env, which VS Code keeps through
    an extension restart. Tabs VS Code kept over a reload and restored after a quit by re-running their command
    (2026-11-09, found by their command line through `ps`) lost their icon: VS Code 1.145 revives a reattached tab's
    file icon as plain data, fails its `instanceof URI` check and draws none, and has no API to set it again. An icon
    font (`contributes.icons`) survives a reload but, per microsoft/vscode#329750, not a restart, and closing and
    reopening every restored tab at start reorders and flickers them.
  - When `aggregor-pty` can't start the agent (a command it can't run), it prints why and waits for Enter, so the tab
    doesn't vanish without a word.
  - tmux learns the tab's colours about 20 ms after the tab attaches and leaves a colour query unanswered until then.
    `aggregor-pty` asking for the background every 20 ms until tmux answered, and only then starting the agent, gave
    Codex's composer the theme's shade in a headless check (`52,53,54` instead of `25,26,27`), but was dropped the same
    day: Codex looked right without it in use, and it held back every agent's start.
  - `ITmuxInfraService` builds the tab's command after checking tmux and `aggregor-pty`, lists and stops sessions, and
    after a tab opens reads tmux's list until it has the session (every 50 ms, up to 5 s); `TerminalInfraService` only
    opens, focuses, names and closes tabs. A row's exited status comes from tmux's session list, read when the window
    starts or regains focus, when a terminal closes, after a session's tab opens and after each stop; it isn't written
    to the database, so the status column keeps one writer.
  - Remove Session asks first while the agent runs, then kills its tmux session and closes its tab.
  - tmux missing or too old fails a start with an error and an **Install tmux** button for tmux's install page.
  - `extensionKind: ["workspace"]`, so in a WSL or remote window the extension, tmux and the agents run there.
- **Why:** an agent outlives its tab, a reload and VS Code, sees the terminal's real colours and VS Code's terminal
  environment, and every tab is one the extension opened, so it starts or resumes the right conversation.
- **Limits:** tmux sets `TERM_PROGRAM=tmux` inside its sessions, so agents see tmux rather than `vscode`. A reload or a
  restart closes the session tabs, and their order and layout with them; the agents keep running. An agent that exits at
  once, such as a resume whose conversation is gone, closes its tab without a word; only `aggregor-pty`'s own failures
  wait for Enter.

### A set of values is an enum value object that exports its values (2026-11-10)

- **Problem:** the agent's states and kinds of wait were `Schema.Literals`, so code compared and returned bare strings
  (`status === "working"`), each one a copy a typo or rename could miss.
- **Options:** a constants object per set in `@pkg/constants`, which the domain can't import. Reading the schema's
  `.enums` in each file that needs a value, one local copy per file (tried and dropped the same day).
- **Decision:** a value object that is a set of values is a `Schema.Enum` with UPPER_CASE keys, and its file exports the
  values as an UPPER_CASE constant beside the schema (`AGENT_STATUSES`, `SESSION_STATUSES`, `STATUS_KINDS`,
  `ENTITY_CHANGE_KINDS` since 2026-11-10); code imports the constant. Presentation, which can't import the domain, looks
  states up in its constants instead of comparing them. Lint bans `Schema.Literals` in value objects, an enum value
  object without its exported constant, `.enums` outside value objects, and comparing with a state, kind-of-wait or
  kind-of-change string. The stored strings are unchanged.
- **Why:** each string is written once, in the domain, and lint keeps it that way for every such value object.

### The CLIs a session runs are agents, one word everywhere (2026-11-10)

- **Problem:** the code called them harnesses (the settings entries, `HarnessEntity`) and agents (the running process,
  its status, the texts the user reads), two words for one thing.
- **Options:** harness everywhere, considered the same day and dropped: "agent" is what users, the agents' own docs and
  the product description call them.
- **Decision:** agent everywhere: `AgentEntity`, `IAgentRepository`, `AgentIdValueObject`, `AgentIconValueObject`,
  `AgentListItemDto`, `agent.constant.ts`, `assets/agents/`, the settings `aggregorApp.agents`,
  `aggregorApp.defaultAgent` and `aggregorApp.skipAgentPicker`, and the `sessions.agentId` column; the stack's branch
  names keep `harness-foundation`, since pushed branches aren't renamed. Lint (`AGENT_NAME_BAN` in `syntaxBans.ts`)
  rejects the other word in names and texts in the extension and `@pkg/constants`.
- **Why:** one word for one thing, and the one users already use.

### Codex resumes its own conversation by id (2026-11-09)

- **Problem:** Codex can't start a conversation under an id we give it, and plain `codex resume` opens a picker of the
  project's conversations rather than the session's own. Codex 0.167 also runs turns in a shared background server by
  default, so ending a session's tmux session left a running turn working with no tab.
- **Options:**
  - `codex resume --last`: the project's newest conversation, wrong once a project has two Codex sessions.
  - Reading Codex's session files (`~/.codex/sessions/…/rollout-‹time›-‹id›.jsonl`), whose layout Codex is migrating.
  - A `SessionStart` hook passed with `-c`, which hands over the id as documented, but Codex holds it behind a "Hooks
    need review" prompt whenever the hook is new or changed.
  - Every agent on its own ids: our id stays the row's, the tmux session's and the status key anyway, so each session
    would carry two; most agents show theirs nowhere (Claude's title is the conversation's name), and an agent that dies
    before showing it can't be resumed.
  - The extension recording the id from the title: more code, and `aggregor-pty` writes what comes from the agent's
    output.
- **Decision:** Codex runs with `-c tui.terminal_title=["thread-title"]`, which makes its window title the thread's id
  until the thread has a name, then the name. `aggregor-pty` writes a window title that is a bare UUID to
  `agentSessionId`, the latest one, so a new thread started with `/new` replaces it. `${agentSessionId}` fills it in,
  and Codex's `resumeArgs` are `resume --no-daemon -c tui.terminal_title=… ${agentSessionId}`; a resume that needs it
  while it is unknown fails with `AgentSessionIdNotFoundError`. Codex runs with `--no-daemon` both ways, so its turns
  stop with its tmux session. Agents that take our id keep it (Claude, OpenCode, Copilot), and Antigravity keeps `-c`.
- **Why:** an exact resume, from a title Codex shows by itself, with no prompt and no reading of Codex's files.
- **Limits:** Codex showing the id as its title isn't documented, and the option replaces any `tui.terminal_title` of
  the user's. Codex sessions don't show in `codex agents`. Codex reports `working` for a moment at startup, so a session
  that never got a message counts as worked, and once its agent has stopped, `codex resume ‹id›` finds no saved thread
  and exits, closing the tab.

### Sessions out of view notify, and the view's badge counts those waiting on you (2026-11-10)

- **Problem:** an agent that waits for permission or finishes while the user looks elsewhere, in VS Code or in another
  app, goes unnoticed until they look at its row.
- **Options:**
  - Bringing the window forward from an OS notification by running `code ‹workspace›`: an untitled workspace, which
    Aggregor's window becomes, has no path to pass.
  - An **Open** button on the desktop notification whose click opened the window's link through `xdg-open` (built and
    tried on 2026-11-10): GNOME on Wayland lets a window come forward only with an activation token, which a click hands
    to the program that sent the notification, `notify-send`. VS Code can't take one from outside: its code never reads
    `XDG_ACTIVATION_TOKEN`, and it doesn't use Electron's `requestSingleInstanceLock`, the way Chromium passes a token
    to a running instance. So the link opened the session, and GNOME kept VS Code in the background.
  - Bringing the right window forward when several VS Code windows are open: kept for "If the users asked" in the
    README, with the problem and a proposal.
  - Only the Linux notification for now, macOS and WSL when someone runs them: dropped, so the release has them for
    contributors to try.
  - Removing `notifyOn` until it is wanted: kept, so the states can be picked.
- **Decision:**
  - `SessionAlertService.watchSessionAlerts` watches the session rows: a write whose `statusChangedAt` moved since the
    window started, with a new state or kind of wait, is a change. Each session's changes pass once they have held for 3
    seconds (`SESSION_ALERT_HOLD_MS`), and only when the state differs from the one held before; idle held after working
    counts as done (`getAlertedStatus`). The session must be out of view when the state changed and once it held, and
    the state in `aggregorApp.notifyOn` (default: blocked, done, error, exited, idle).
  - `SessionAlertsView` shows each alert: the focused window as its own notification with **Open**, which runs the open
    command; an unfocused one through `IDesktopNotificationInfraService`.
  - On Linux, `notify-send --wait` with `NOTIFY_IGNORE_PORTAL=1`, a `desktop-entry` hint naming VS Code's desktop file
    (from `CHROME_DESKTOP`, `com.microsoft.VSCode.desktop` in 1.145), the agent's logo as the `image-path` hint and
    Aggregor's light logo as `--app-icon`, with no button. GNOME Shell 50 (`notificationDaemon.js`) then files the
    notification under VS Code, so its header shows VS Code's name and icon, and a click on it runs `app.activate()`,
    which brings VS Code's most recently used window forward and switches to its workspace, as for Ghostty. `--wait`
    keeps `notify-send` connected: GNOME deletes a notification filed under an app as soon as its sender leaves the bus.
    libnotify routes a snap's or flatpak's notifications through the portal, which drops hints, and the extension host
    can inherit a snap terminal's environment.
  - GNOME tells the sender only that the notification closed, the same for a click as for its X, so the window opens the
    session when it came into focus within 1.5 seconds of that (`DESKTOP_NOTIFICATION.CLICK_FOCUS_MS`). A click closes
    every VS Code notification at once, so the first alert to see the focus uses it up and the others open nothing.
  - From WSL (a kernel release naming microsoft), a PowerShell toast whose click opens a link
    (`vscode://salmanafzal.aggregor-app/openSession?sessionId=…`, from `env.asExternalUri`, which adds the window's id)
    through Windows; the view's URI handler opens the session, and VS Code asks once whether the extension may open
    links. On macOS, `osascript`'s `display notification`, whose click opens Script Editor. Neither shows the logos:
    osascript always shows Script Editor's icon, and toasts take PNG or JPG, not the SVG logos. Native Windows sends
    none, since its sessions run in WSL.
  - The Sessions view's badge, which VS Code also shows on the activity bar, counts the sessions blocked, errored or
    with a finished turn unseen (`isSessionWaitingOnUser`), and its tooltip lists them; it is read again on every
    session list change.
- **Why:** a state that holds is news, quick sequences raise one notification, and Antigravity's 2-second sign-in check
  at every start raises none. Only GNOME may bring VS Code forward, and it does so for a notification it files under VS
  Code.
- **Limits:** VS Code can't close a notification once shown, so one can outlive its state; Open still goes to the
  session. Each window sends its own, so two windows notify twice. With several VS Code windows, a click brings the most
  recently used one forward, which may not be the one that sent it; that one then opens nothing (see "If the users
  asked" in the README). Focusing the window within 1.5 seconds of dismissing a notification with its X opens the
  session too. A desktop notification waiting keeps a `notify-send` process until it is clicked or dismissed, and
  Ubuntu's AppArmor profile for `notify-send` keeps VS Code from stopping it, so it outlives a reload. The WSL toast and
  macOS notification are untested.

### A session's tab shows its row's name (2026-11-09)

- **Problem:** session tabs opened without a name to show the agent's own title, but VS Code 1.145 shows a terminal's
  title in its tab only for the agent CLIs it recognizes (Claude Code, Codex, Copilot, Gemini), by process name or title
  text. Under `aggregor-pty` only Claude and Copilot are recognized, by their titles, and every other tab showed
  `aggregor-pty`.
- **Options:** `aggregor-pty` writing the session's name as the terminal title, with the window showing terminal titles
  in tabs: background tabs follow too, but every terminal tab in the window, shells included, would change. The
  extension hosting the terminal as a Pseudoterminal, which can rename any tab: all agent output would pass through the
  extension host, and the tmux attach would change. `titleTemplate`, a proposed API the Marketplace refuses.
- **Decision:** a session's tab opens with the session's `displayName` and `startSessionTabNameSync` keeps it there:
  after any write to a session and whenever a session's tab becomes the active terminal, the active tab is renamed if
  its name differs. VS Code renames only the active terminal, so a tab in the background takes a new name when it next
  comes to the front. Rename from the row menu no longer brings the tab to the front, and an empty name hands the tab
  back to the agent's title at once.
- **Why:** the row and the tab say the same thing for every agent, from the one name in the database. Claude's and
  Copilot's tabs lose their live marks (✳, the spinner); the row's badge shows the status.

### A gear in the Sessions title bar opens Aggregor's settings (2026-11-09)

- **Options:** a controller, `SettingsService` and an `ISettingsConfig` call, so every command takes the same path.
- **Decision:** **Open Settings** (`aggregorApp.openSettings`, `$(gear)`) after Add Project opens the Settings editor at
  `@ext:<extension id>`. `routes.ts` registers it straight to `openAggregorSettingsInSettingsEditor` in `@pkg/vscode`,
  with `presentAppCommandError`, the presenter for commands that cannot fail.
- **Why:** it reads and writes no data, and presentation already opens settings itself for an error's Open Settings
  button.

### New Session asks which agent, among those installed (2026-11-09)

- **Problem:** with five built-in agents, starting a session has to say which, and offering one that isn't installed
  only fails in its terminal.
- **Options:** `AgentRepository.findAll` leaving out uninstalled agents, which mixes what is configured with what is on
  this machine. Saving the default from inside the picker while it stays open, which puts the decision in
  infrastructure. Error messages without a way to the setting.
- **Decision:**
  - The project row's "New Claude Session" became "New Session"; the title bar's "New Session..." asks for the project
    first, then the agent. Command ids didn't change.
  - The picker lists the agents whose command is on `PATH` (plus `PATHEXT` on Windows), looked up in the extension host
    each time through `IShellCommandInfraService.listInstalledCommands`, so a new install shows without a reload. Each
    row is an `AgentListItemDto`: icon, name, the command as the description, the default first and marked.
  - A row's **Set as Default** button ends the pick; the use case saves `aggregorApp.defaultAgent` to user settings
    through `ISettingsConfig.saveDefaultAgentId` and shows the picker again, reordered.
  - One agent installed, or `aggregorApp.skipAgentPicker` on with the default installed, starts it without the picker;
    none installed fails with `NoAgentInstalledError`, naming the commands searched for, with **Open Settings**.
- **Why:** the use case decides and the picker only shows; whether a command is installed is a fact about the machine,
  not the configuration.

### Aggregor keeps its files in one folder, `~/.aggregor` (2026-11-09)

- **Problem:** the database and `aggregor-pty`'s log sat at the top of `~/.aggregor`, and the anchor folder deep in VS
  Code's global storage, which each profile, and Insiders, has its own of: every profile got its own anchor and saved
  workspace while all of them shared one project list.
- **Options:** the anchor folder in global storage (2026-11-05 to 2026-11-09). The anchor folder straight under
  `~/.aggregor`, beside the database files. `~/.aggregor` itself as the anchor folder, which would make VS Code watch
  the database.
- **Decision:** `~/.aggregor` (or `$AGGREGOR_HOME`, which replaced `$AGGREGOR_DATA_DIR`) holds `data/` (`aggregor.db`,
  its WAL files and `aggregor-pty.log`) and `anchor/` (`Aggregor/`, the anchor folder, and since 2026-11-10
  `Aggregor.code-workspace` and `sessionToReopen.json`; the `saveOffered` marker until then). `getAggregorFolderPath`
  reads it, and `getDatabaseFilePath` and `getAnchorFolderPath` build on it. `VsCodeApi` no longer carries
  `globalStorageUri`. Nothing moves the old files: the first switch after the change finds folder 0 is not the new
  anchor folder and anchors the window again.
- **Why:** one place to find everything Aggregor stores, and every profile opens the same Aggregor workspace. A second
  window, in any profile, now shares the anchor folder's settings, as a second window in one profile already did.

### The F5 build keeps its own Aggregor folder, `~/.aggregorDev` (2026-11-10, #98)

- **Problem:** the build F5 runs and the installed Marketplace build shared `~/.aggregor`: one database, one tmux server
  and one anchor workspace. A dev schema change, which regenerates the migration from zero, broke the installed
  extension's database; F5's sessions showed in the installed extension's list; and the F5 window couldn't open the
  anchor workspace while the other window had it open, since VS Code shows that window instead.
- **Options:**
  - The extension picks `~/.aggregorDev` itself when VS Code runs it in development mode, with no variable; a
    `.env.development` file that `launch.json` loads.
  - Naming the variable `AGGREGOR_DATA_DIR` again: the folder holds `anchor/` and `tmux.sock` besides its own `data/`,
    and beside a database variable it would read as moving only `data/`.
  - Variables for the tmux socket and the anchor folder, which follow the folder, so dev and installed builds already
    get their own; a separate socket variable could put two folders on one tmux server. `AGGREGOR_PTY_BINARY`, for a
    cargo debug build, which `build:pty` already copies in.
  - Expanding a leading `~`, which a shell does before VS Code sees the value and `launch.json` writes as `${userHome}`.
- **Decision:**
  - "Run Extension" in `.vscode/launch.json` sets `AGGREGOR_HOME` to `${userHome}/.aggregorDev`; unset, as in the
    installed extension, it stays `~/.aggregor`. The verify skill keeps its own folder.
  - `AGGREGOR_DATABASE_FILE` names the database file, `data/aggregor.db` in the Aggregor folder by default, to try
    another database; `aggregor-pty` gets it through `--database` and writes its log beside it.
  - Both are read through Effect's `Config` by `readAbsolutePathVariable`; a value that isn't an absolute path fails
    activation with an error naming the variable.
  - `~/.aggregor` keeps what it holds, dev and installed rows alike; `~/.aggregorDev` starts empty. Nothing is copied or
    deleted. The database error messages no longer name `~/.aggregor/data`.
- **Why:** one variable already moved everything, so F5 only had to set it, and swapping the database is one more.

### One project in view, behind a hidden anchor folder (2026-11-05, #68)

- **Problem:** with every project a workspace folder, Explorer, search, file watching and Source Control span all of
  them, and git watches each repository recursively. Changing workspace folder 0 restarts every extension; only VS
  Code's own Agents window is exempt.
- **Options:** swap folder 0 on each switch, restarting every extension each time; an extension-owned anchor at
  folder 0.
- **Decision:** the first switch puts a hidden anchor folder (`~/.aggregor/anchor/Aggregor`) at folder 0 and the viewed
  session's project at folder 1, by opening Aggregor's workspace file (see "Aggregor's workspace is a file Aggregor
  writes"); later switches swap only folder 1. Session terminals carry `AGGREGOR_SESSION_ID` in their env, so they are
  found again after an extension restart, and the anchor's `terminal.integrated.cwd` makes New Terminal open in the
  shown project.
- **Why:** one reload instead of an extension restart per switch. TypeScript, ESLint, Prettier, rust-analyzer and Lua
  all follow the shown project; mise needs `mise.selectWorkspaceFolder` after each switch.

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
  the window's own folders. One anchor folder, `~/.aggregor/anchor/Aggregor`. The windows tables went with a generated
  migration, which leaves every project unadded.
- **Why:** less to build and keep. Adding windows back is one table and a migration. Since step 5 a second window shows
  the same sessions and opening a running one attaches to its tmux session; before, it would start a second agent on its
  id.

### Listed projects are `ProjectListItemDto`s (2026-11-07; a DTO since 2026-11-09)

- **Problem:** a workspace folder is listed before its project has a row, so a listed project can't be the stored
  `ProjectEntity`.
- **Decision:** `ProjectService.listProjects` returns `ProjectListItemDto`s (path, name, isAdded), built from the
  workspace folders and the added projects; a project's row is made the first time it is added or given a session. Until
  2026-11-09 these were `ListedProjectValueObject`s, but a project identified by its path is no value object.

### Aggregor's workspace is a file Aggregor writes (2026-11-10; an offer to save it from 2026-11-06, #68)

- **Problem:** the first switch turned the window into an unsaved multi-root workspace, named Untitled, which asks to be
  saved when the window closes; no API saves one silently, so the window offered once to open Save Workspace As
  (2026-11-06 to 2026-11-10), a dialog on a fresh start.
- **Options:** VS Code's `window.confirmSaveUntitledWorkspace`, a user setting that would stop the question for every
  untitled workspace and discard them on close.
- **Decision:** the first switch, in a window that isn't a saved workspace with the anchor folder at folder 0, writes
  `~/.aggregor/anchor/Aggregor.code-workspace` (the anchor folder, then the project) and opens it in the window with
  `vscode.openFolder` (`forceReuseWindow`). Opening it reloads the window, which closes the session tabs, whose agents
  keep running, so `sessionToReopen.json` beside it keeps the session being switched to and the reloaded window opens it
  (`WorkspaceService.startSessionReopenAfterReload`); one older than a minute is ignored. Later switches swap folder 1,
  which VS Code writes into the file. A workspace saved earlier with the anchor at folder 0 is kept. Add Project in an
  empty window opens the file the same way, with no session to reopen.
- **Why:** no question, ever; the window is named Aggregor and shows in Open Recent.
- **Limits:** the first switch reloads the window instead of only restarting the extensions, so editors and terminals
  come back as after any reload. When another window already has the file open, VS Code shows that window and this one
  stays as it was; the session to reopen then expires unused.

### Wait for the git extension before reading its API (2026-11-01, #47)

- **Problem:** the git extension may not be active yet when aggregor reads its exports.
- **Decision:** call its `activate()` and use what it returns.
