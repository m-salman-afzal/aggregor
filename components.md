# Components

What Aggregor is built from, runs on, and is checked and released with: what each component is, which part of it we use,
why, and what else was weighed. [decisions.md](decisions.md) holds the full reasoning; an entry named here is a heading
there. Update this file in the same commit as a change that adds, removes or changes how a component is used.

## On the user's machine

### VS Code

- **What it is:** the editor the extension runs in, through its extension API.
- **What we use:** `engines.vscode` `^1.145.0`, `extensionKind: ["workspace"]` (in a WSL or remote window the extension,
  tmux and the agents run there), the Aggregor activity-bar container with the Sessions and Archive views, menus and
  `aggregorApp.*` settings. APIs: `createTreeView` with drag and drop, `registerFileDecorationProvider` for row badges,
  `createTerminal` (`shellPath`, `isTransient`, an editor-tab `location`, `env`, `iconPath`), `createQuickPick`,
  `showInputBox`, `withProgress`, `registerUriHandler` with `env.asExternalUri`, a log `createOutputChannel` for the
  trace, `workspace.updateWorkspaceFolders`, `openTextDocument` and `applyEdit`, and the `vscode.openFolder` command.
  `packages/vscode` holds `VsCodeApi`, the one runtime `vscode` import.
- **Why:** terminals, trees, Source Control and diffs already exist in VS Code, through stable APIs only.
- **Alternatives:** "Agents run in their own terminal UIs": an ACP client with a webview chat UI; VS Code's chat
  sessions API, a proposed API. "Every session's agent runs in tmux": tabs drawn as `Pseudoterminal`s over one tmux
  control-mode client. harness-foundation 3, Decided 1: codicon row badges, a proposed API. "Questions are asked in VS
  Code's quick pick": modal warnings, notifications with buttons, changing `window.dialogStyle`.

### tmux

- **What it is:** a terminal multiplexer whose sessions keep running with no client attached.
- **What we use:** tmux 3.2 or newer from `PATH`; without it a start fails with an Install tmux button. The calls live
  in `infrastructure/services/tmux/tmux.infraService.ts`, with names in `packages/constants/src/tmux.constant.ts`:
  - `tmux -V` before each start.
  - A session's tab runs tmux itself, with no shell:
    `tmux -S ‹socket› -f ‹extension›/assets/tmux.conf -u new-session -A -s ‹sessionId› [-e NAME=value]… -c ‹project› -- aggregor-pty …`.
    `-A` attaches when the tmux session runs and starts it otherwise; `-e` passes the agent's `env` setting.
  - `list-sessions -F '#{session_name}'` reads which agents run; `kill-session -t =‹sessionId›` stops one;
    `source-file ‹conf›` reloads the config into a server that already runs, since `-f` is read only at server start.
  - `assets/tmux.conf` replaces `~/.tmux.conf`: no prefix, no status bar, mouse on, 50,000 lines of history,
    `escape-time 0`, `focus-events`, `extended-keys`, `window-size latest`, 24-bit colour, OSC 52, and
    `update-environment` for VS Code's terminal variables and `AGGREGOR_SESSION_ID`.
- **`tmux.sock`:** the Unix socket Aggregor's own tmux server listens on. `getTmuxSocketPath`
  (`apps/extension/src/infrastructure/utils/tmuxSocket.utils.ts`) puts it in the Aggregor folder: `~/.aggregor`,
  `~/.aggregorDev` for the F5 build (`.vscode/launch.json` sets `AGGREGOR_HOME`), or `$AGGREGOR_HOME`. Every call passes
  `-S ‹socket›`, so it reaches only that server. tmux creates the socket, readable only by its owner, when the first tab
  starts, and the server exits with its last session. A server of its own keeps Aggregor's sessions and `tmux.conf`
  apart from the user's tmux and `~/.tmux.conf`, and gives each Aggregor folder its own server, so the installed build,
  the F5 build and a test never share one (harness-foundation 5, Decided 4; `storage.md`).
- **Why:** an agent outlives its tab, a reload and VS Code. The tab is attached from the agent's first byte, so tmux
  answers its colour queries, and the agent gets the tab's terminal environment.
- **Alternatives:** "Every session's agent runs in tmux": a hidden VS Code terminal running `tmux new-session -d` with
  the tab only attaching; tmux as the extension's child process; one control-mode (`-CC`) client for every tab.
  harness-foundation 5, Decided 3: a pkexec install prompt and a bundled tmux (README's M5 plans a bundled tmux).
  Decided 4: a named server, `-L aggregor`. The harness-foundation plan names psmux for native Windows later.
  - Other options for the multiplexer itself, not weighed in decisions.md: GNU screen, Zellij, dtach or abduco.

### aggregor-pty

- **What it is:** Aggregor's own Rust binary (`apps/pty`), shipped as `bin/aggregor-pty` in the Linux and macOS VSIXs.
- **What we use:** `aggregor-pty --database ‹db› --session ‹sessionId› -- ‹command› ‹args›…` inside each tmux session.
  It runs the agent in a pty of its terminal's size and copies bytes both ways (`main.rs`, `terminal.rs`), finds OSC
  7501 and OSC 0/2 in the output (`scanner.rs`) and answers `OSC 7501 ; ?`, checks reports against the spec
  (`report.rs`), and writes the status, title and `agentSessionId` columns onto the session's row from a writer thread
  (`store.rs`), `exited` when the agent exits. Errors go to `data/aggregor-pty.log`. `build:pty` builds it into
  `apps/extension/bin/`.
- **Why:** status comes from the agent's own OSC 7501 reports and titles, which only a process between the agent and its
  terminal can read; VS Code's terminal API can't.
- **Alternatives:** "`aggregor-pty` runs each agent and records its status": one `agentTitle` column picked by the
  binary, writing the database from the output thread, printing errors to the agent's screen. harness-foundation's plan,
  Agreed 7: Claude Code hooks, transcript lookups and title guessing as the source of status.

### portable-pty

- **What it is:** a Rust crate from WezTerm that opens pseudo-terminals on Unix and Windows.
- **What we use:** 0.9.0: `native_pty_system().openpty(PtySize)`, `slave.spawn_command(CommandBuilder)`,
  `MasterPty::resize` and `ChildKiller` (`apps/pty/src/main.rs`).
- **Why:** it also covers native Windows, planned later. Its last release is from February 2025, so Renovate's
  abandoned-package warning is off for it.
- **Alternatives:** "`aggregor-pty` runs each agent and records its status": a pty layer of our own on rustix, with
  fewer and newer crates but Unix only.

### rusqlite

- **What it is:** a Rust SQLite binding.
- **What we use:** 0.41.1 with `bundled`, which compiles SQLite into the binary: `Connection::open_with_flags`,
  `busy_timeout`, and one `UPDATE` by `id` per change that skips soft-deleted rows (`apps/pty/src/store.rs`).
- **Why:** the binary writes the session rows of the database the extension reads.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: sqlx, the `sqlite` crate, or the `sqlite3` CLI.

### rustix

- **What it is:** a Rust crate of safe bindings to POSIX system calls.
- **What we use:** 1.1.6 with `termios`: `tcgetattr` and `tcsetattr` for raw mode and its restore, `tcgetwinsize` for
  the window size (`apps/pty/src/terminal.rs`).
- **Why:** `aggregor-pty`'s terminal goes into raw mode, and the agent's pty takes its size.
- **Alternatives:** Not weighed in decisions.md as the termios layer.
  - Other options: nix, libc, or the termios crate.

### signal-hook

- **What it is:** a Rust crate for Unix signals.
- **What we use:** 0.4.6: `iterator::Signals` for `SIGWINCH` (resize the pty) and `SIGHUP`, `SIGTERM` and `SIGINT`
  (passed on to the agent), in `apps/pty/src/main.rs`.
- **Why:** resizes and hangups reach the agent.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: nix's `sigaction`, ctrlc, or tokio's signal module.

### base64

- **What it is:** a Rust base64 crate.
- **What we use:** 0.23.1: a `GeneralPurpose` engine that decodes base64 values in OSC 7501 reports
  (`apps/pty/src/report.rs`).
- **Why:** OSC 7501 reports carry some values in base64.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: data-encoding, or a hand-written decoder.

### SQLite

- **What it is:** the embedded database engine behind `~/.aggregor/data/aggregor.db`.
- **What we use:** one file every window and every `aggregor-pty` opens: Node's built-in `node:sqlite` in the extension
  (VS Code 1.145's Electron: Node 24.22, SQLite 3.53.4), rusqlite's bundled SQLite in `aggregor-pty`. WAL mode, a
  5-second busy timeout, foreign keys, migrations in one write transaction, `VACUUM INTO` for the backup before
  migrating (`infrastructure/utils/database.utils.ts`), and `PRAGMA data_version` read every 250 ms to see other
  connections' writes (`infrastructure/repositories/base/`). `storage.md` describes the file.
- **Why:** a file any process can write, real relations, and no native module to ship.
- **Alternatives:** "Projects and sessions live in SQLite": VS Code's `globalState`; a native SQLite module, which needs
  a build per Electron version. "Windows see outside writes by polling `data_version`": re-reading on focus, watching
  the WAL file, a socket from the binary, a change counter column kept by triggers.

### Agent CLIs

- **What it is:** the coding agents whose own terminal UIs run in session tabs.
- **What we use:** the built-ins in `aggregorApp.agents`' default (`apps/extension/package.json`): `claude` (Claude
  Code), `codex`, `agy` (Antigravity), `opencode` and `copilot` (GitHub Copilot), each with its start and resume
  arguments; any other CLI is one settings entry. Each reports status through OSC 7501, except Copilot, which sends none
  and shows as idle. New Session lists those whose command is on `PATH` (`os/shellCommand.infraService.ts`).
- **Why:** each agent keeps its own UI, and VS Code supplies the rest.
- **Alternatives:** "Agents run in their own terminal UIs": an ACP client with a webview chat UI, VS Code's chat
  sessions API. The harness-foundation plan: Antigravity in place of Gemini CLI, which is deprecated; crush, goose, pi
  and grok as later built-ins. "Codex resumes its own conversation by id": `codex resume --last`, reading Codex's
  session files, a `SessionStart` hook.

### Claude Code CLI for commit messages

- **What it is:** Claude Code's non-interactive mode, the default command behind the Source Control commit message
  button.
- **What we use:** `aggregorApp.commitCommand`, by default
  `claude -p "…" --system-prompt "…" --tools "" --no-session-persistence --model claude-haiku-5-5 --effort low`, run
  through a shell in the repository root with the staged diff on stdin; stdout is the message
  (`infrastructure/services/commitCli/commitCli.infraService.ts`). The prompt has no inner double quotes, so it runs the
  same under sh and cmd.exe. `.vscode/settings.json` overrides it here with aggregor's scopes.
- **Why:** not recorded; "Commit messages come from a shell command" makes it a setting any command can replace.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: the Anthropic API called from the extension, or VS Code's Language Model API (`vscode.lm`).

### VS Code's Git extension

- **What it is:** VS Code's built-in Git extension, `vscode.git`, and its API.
- **What we use:** `activate()`, then `getAPI(1)`: `getRepository`, `state.indexChanges`, `diff(true)` for the staged
  diff, `inputBox.value`, `commit` and `status()`, plus the `git.stageAll` command
  (`infrastructure/services/vscode/git.infraService.ts`). Its types are `packages/typings/src/git.d.ts`, fetched by
  `pnpm --filter=@pkg/typings sync:git-types`. Agents get its credential helper through tmux's `update-environment`.
- **Why:** "Review agent edits with git": Source Control and its diffs already exist.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: the `git` CLI, simple-git, or isomorphic-git.

### Desktop notifiers

- **What it is:** each system's command for a desktop notification.
- **What we use:** `infrastructure/services/os/desktopNotification.infraService.ts`, when no VS Code window is focused:
  - Linux: `notify-send --app-name … --app-icon ‹logo› --wait` with a `desktop-entry` hint from `CHROME_DESKTOP` and the
    agent's logo as `image-path`, under `NOTIFY_IGNORE_PORTAL=1`. GNOME files it under VS Code, so a click brings VS
    Code forward.
  - macOS: `osascript` with a `display notification` script that takes the texts as arguments.
  - WSL: `powershell.exe -NoProfile -NonInteractive -EncodedCommand ‹script›`, a Windows toast whose click opens a
    `vscode://salmanafzal.aggregor-app/openSession?sessionId=…` link.
- **Why:** a session out of view that needs the user reaches them when VS Code isn't focused, and only GNOME may bring
  VS Code forward.
- **Alternatives:** "Sessions out of view notify, and the view's badge counts those waiting on you": `code ‹workspace›`,
  which an untitled workspace has no path for; an Open button whose link opens through `xdg-open`, which leaves VS Code
  in the background; Linux only.

## Inside the extension

### Effect

- **What it is:** a TypeScript library for typed errors, services, concurrency and tracing.
- **What we use:** `effect` 4.1.2: `Effect.fn` for every function, which gives it its span; `Layer` and `Context` for
  services (`infrastructure/di/app.layer.ts`); `ManagedRuntime` in `extension.ts`; `Schema` for tagged errors, entities,
  enum value objects and argument decoding; `Result`; `Stream`, `SubscriptionRef`, `PubSub` and `Schedule`; `Config`;
  `Tracer` and `Logger` for the trace log (`infrastructure/logger/traceLog.layer.ts`); and the unstable `effect/sql`,
  `effect/process` (`ChildProcess`), `effect/FileSystem`, `effect/Path`, `effect/crypto` (`SecureRandom.uuidV7`) and
  `effect/reactivity`, each allowed by name in `packages/tsconfigs/tsconfig.base.json`.
- **Why:** "Effect 4" records no reason for the choice; it is what gives every function its span and every failure a
  typed error.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: plain async TypeScript with OpenTelemetry, fp-ts, or neverthrow.

### @effect/platform-node

- **What it is:** Effect's Node.js implementations of its platform services.
- **What we use:** 4.1.2: `NodeServices.layer`, for `FileSystem`, `Path` and `ChildProcessSpawner`
  (`infrastructure/di/app.layer.ts`).
- **Why:** the code asks for Effect's platform services, and this layer provides them in the extension host.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: `node:fs` and `node:child_process` directly, or execa.

### @effect/sql-sqlite-node

- **What it is:** Effect's SQL client for SQLite on Node's built-in `node:sqlite`.
- **What we use:** 4.1.2: `SqliteClient.layer({filename})` for the window's connection, with its default WAL mode and
  busy timeout (`infrastructure/di/database.layer.ts`), and `SqliteClient.make({readonly: true})` for the backup.
- **Why:** no native module, and every query shows in the trace.
- **Alternatives:** "Projects and sessions live in SQLite": a native SQLite module. "The database is backed up before it
  migrates": `node:sqlite` itself for the backup, which left that query out of the trace.

### Drizzle ORM

- **What it is:** a TypeScript ORM: table definitions, a query builder and a migrator.
- **What we use:** `drizzle-orm` 1.0.0-rc.5, pinned: `sqlite-core` (`sqliteTable`, `text`, `integer`, `references`,
  `getTableConfig`) for the table models in `infrastructure/database/models/`; the query builder (`select`, `innerJoin`,
  `insert … onConflictDoUpdate … returning`, `update`, `max`, `sql`) in `infrastructure/repositories/base/`; the Effect
  4 driver `drizzle-orm/effect-sqlite-node` on the same `SqliteClient`; and its migrator, which records applied
  migrations in `__drizzle_migrations`.
- **Why:** each table is declared once, in TypeScript, drizzle-kit derives its migrations, and queries still run through
  Effect's client.
- **Alternatives:** "Drizzle on Effect defines the tables, builds the queries and generates the migrations":
  hand-written `CREATE TABLE`s with a `PRAGMA user_version` rebuild; Effect's `Model.Class` with
  `SqlModel.makeRepository`; `@effect/sql-drizzle` and `@effect/sql-kysely`, which need Effect 3; an `effect-orm`
  project, not evaluated. "Drizzle updates only to its releases": its `-‹hash›` branch builds.

### jsonc-parser

- **What it is:** Microsoft's parser and editor for JSON with comments, the one VS Code uses.
- **What we use:** 3.3.1: `parse`, `modify` and `applyEdits` in
  `infrastructure/services/vscode/workspace.infraService.ts`, to sync the shown project's `.vscode/settings.json` with
  `Aggregor.code-workspace`.
- **Why:** it keeps each file's comments and indentation, and it is the parser VS Code uses.
- **Alternatives:** "The shown project's own settings sync with Aggregor's workspace file": VS Code's settings API, one
  key at a time, which refuses the keys of extensions that aren't installed.

## Building and checking

### Node.js

- **What it is:** the JavaScript runtime for the tooling.
- **What we use:** 26.13.0, pinned by `devEngines` with `onFail: error`; CI's `pnpm/setup` installs it. The extension
  runs on the Node in VS Code's Electron (24.22 in VS Code 1.145), so Vite targets `node24`.
- **Why:** not recorded; "pnpm workspace with pinned Node and pnpm" records the pin.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: nvm with an `.nvmrc`, Volta, or mise.

### pnpm

- **What it is:** the package manager and workspace runner.
- **What we use:** 12.18.0, pinned by `packageManager` and `devEngines`: the workspace (`apps/*`, `packages/*`),
  `--filter` scripts, and one `catalog:` in `pnpm-workspace.yaml` for every version, with `catalogMode: strict` and
  `cleanupUnusedCatalogs`.
- **Why:** "Every dependency version lives once, in the pnpm catalog": one source of truth, which lint keeps.
- **Alternatives:** "Every dependency version lives once, in the pnpm catalog": named catalogs.
  - Other options for the package manager, not weighed in decisions.md: npm workspaces, Yarn, or Bun.

### TypeScript

- **What it is:** the language and its type checker.
- **What we use:** `tsc` is TypeScript 7.0.2's native compiler (`@typescript/native`, an alias of `typescript@7.0.2`),
  run as `tsc --noEmit` by `pnpm typecheck`. The `typescript` name resolves to 6.0.2 (`@typescript/typescript6`), a
  dependency of `@pkg/eslint`. Options live in `packages/tsconfigs/tsconfig.base.json`, aliases in
  `apps/extension/tsconfig.json`.
- **Why:** "`@effect/tsgo` on TypeScript 7 native" records the native compiler; no reason for TypeScript 6 is recorded.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: TypeScript 5 or 6's `tsc` alone.

### @effect/tsgo

- **What it is:** Effect's language service for the TypeScript 7 native compiler.
- **What we use:** 0.67.5. `effect-tsgo patch --typescript` in the root `prepare` script patches `tsc`; the editor uses
  it through `js/ts.experimental.useTsgo` in `.vscode/settings.json`. `tsconfig.base.json` makes every rule an error in
  `apps/extension/src` and lists the allowed unstable modules.
- **Why:** Effect's rules run in `pnpm typecheck` and in the editor.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: `@effect/language-service` on TypeScript's JavaScript server.

### Vite

- **What it is:** a build tool; its library mode bundles with Rolldown.
- **What we use:** 8.3.6, `apps/extension/vite.config.ts`: `src/extension.ts` into one ES module, `dist/extension.js`,
  for `node24`, with `vscode` and Node's built-in modules external; minified in production, source maps in development.
  `watch:vite` rebuilds for F5, and `vscode:prepublish` runs `vite build --mode production`.
- **Why:** not recorded; "Vite bundles, vsce packages" records that the extension ships as one bundle, which vsce
  packages with `--no-dependencies`.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: esbuild (VS Code's extension template), webpack, or tsup.

### drizzle-kit

- **What it is:** Drizzle's migration generator.
- **What we use:** 1.0.0-rc.5, pinned, configured in `apps/extension/drizzle.config.ts`.
  `pnpm db:generate --name ‹change›` writes `assets/migrations/‹timestamp›_‹change›/`; `.vscodeignore` leaves its
  `snapshot.json` out of the VSIX. `pnpm db:check` generates into a temporary copy and fails when that writes a new
  migration.
- **Why:** each schema change is a migration derived from the table models, run on the user's database.
- **Alternatives:** "Every schema change is a migration on the user's database": `drizzle-kit check`, which checks the
  migrations folder, not that the models match it.

### ESLint

- **What it is:** a JavaScript and TypeScript linter.
- **What we use:** 10.14.0, `pnpm lint:check` with `--max-warnings 0`. `@pkg/eslint` (`packages/eslint/src`) holds
  `base/` per file type, `layers/` for the DDD layering, and `rules/`, the aggregor plugin (`span-name`,
  `constant-placement`, `type-placement`, `declaring-file`, `stem-folder`). Plugins: typescript-eslint, unicorn,
  perfectionist, import-x, e18e, `@eslint/markdown`, `@eslint/json`, eslint-package-json, eslint-plugin-pnpm (the
  catalog checks) and eslint-plugin-prettier.
- **Why:** "Conventions are enforced by lint, not prose".
- **Alternatives:** "The ESLint setup lives in `@pkg/eslint`": the base setup at the root, one file per category.
  - Other options for the linter, not weighed in decisions.md: Biome or oxlint.

### Prettier

- **What it is:** a code formatter.
- **What we use:** 3.9.10, `.prettierrc`: 120 columns, `proseWrap: always`. `pnpm format:check`, and staged files before
  each commit.
- **Why:** not recorded; "Lint and format on commit" records the setup.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: Biome or dprint.

### vitest

- **What it is:** a test runner built on Vite.
- **What we use:** 5.1.0, `pnpm test`: `apps/extension/tests/migrations.test.ts`, which builds a database at each
  migration, fills it, migrates it to the newest and checks nothing was lost. `vitest.config.ts` resolves the tsconfig
  aliases; each test runs its effect with `Effect.runPromise`.
- **Why:** it resolves the extension's aliases, so the test runs the extension's own migration code.
- **Alternatives:** "Every schema change is a migration on the user's database": Node's own test runner, which can't
  resolve the aliases; `@effect/vitest`, whose every export `@effect/tsgo` reports as unstable.

### husky and lint-staged

- **What it is:** a git hooks installer, and a runner for checks on staged files.
- **What we use:** husky 9.1.7, installed by `prepare`, runs `pnpm lint-staged` from `.husky/pre-commit`. lint-staged
  17.6.0 (root `package.json`) runs `prettier --check` then `eslint --max-warnings 0` on every staged file, and
  `rustfmt --check --edition 2024` on `.rs` files. It checks the index, so a moved file edited after must be staged
  again. Renovate's abandoned-package warning is off for husky.
- **Why:** not recorded; "Lint and format on commit" records the setup.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: lefthook, simple-git-hooks, or pre-commit.

### Rust toolchain

- **What it is:** rustup, cargo, rustfmt and clippy.
- **What we use:** Rust 1.99.1, pinned in `apps/pty/rust-toolchain.toml`; edition 2024; release builds with LTO and
  stripped symbols. `pnpm pty:check` runs `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`;
  `pnpm pty:test` runs `cargo test`, whose `tests/end_to_end.rs` runs the binary against a database built from the
  extension's migrations.
- **Why:** "Rust for `aggregor-pty`, checked like the TypeScript": one command checks the whole repo.
- **Alternatives:** Not weighed in decisions.md as the language for the binary.
  - Other options: Go, C, Zig, or a Node.js script.

### mutter (headless verification)

- **What it is:** GNOME's Wayland compositor, run headless for the `verify-in-vscode` skill.
- **What we use:** `.claude/skills/verify-in-vscode/vscode.ts` runs `mutter --headless --no-x11` and
  `code --ozone-platform=wayland --remote-debugging-port=9447` inside `dbus-run-session`, with its own profile and
  Aggregor folder under `~/.cache/aggregor-verify`. `cdp.ts` drives the window over the Chrome DevTools Protocol, and
  hooks in `.claude/settings.json` stop it when a turn or session ends.
- **Why:** a check never opens a window on the user's screen, and nothing it starts outlives the turn.
- **Alternatives:** "Verify changes in a headless VS Code": a visible window, and Xvfb, turned down to stay on Wayland.

### Small packages

- `npm-run-all2` 9.0.4: `pnpm watch` runs `watch:vite` and `watch:tsc` together.
- `@types/node` 26.6.6; `@types/vscode` 1.145.0, a plain version in `apps/extension` and `packages/vscode` because vsce
  reads it to check `engines.vscode`; `@types/eslint-plugin-promise` 7.3.0.

## Releasing

### GitHub Actions

- **What it is:** GitHub's CI runner.
- **What we use:** `checks.yaml` (one job per script: lint, format, typecheck, test, `db:check`, `pty:check`,
  `pty:test`, `vsix`), `auto-pr.yaml` (opens and stacks PRs), `pr-title.yaml`, `release-pr.yaml` (dev → main once a bump
  merges) and `release.yaml` (binaries, VSIXs, publish, GitHub release), in `.github/workflows/`. Actions are named by
  exact tag, with each tag's commit in `.github/workflows/actions.lock`.
- **Why:** not recorded in decisions.md.
- **Alternatives:** "Releases start from merged PRs": a release from a pushed git tag. "Actions pinned to exact tags,
  with a lock file": commit digests in the workflows.
  - Other options for the CI service, not weighed in decisions.md: GitLab CI or Buildkite.

### vsce

- **What it is:** `@vscode/vsce`, the tool that packages and publishes VS Code extensions.
- **What we use:** 4.1.0. `vsce package --no-dependencies --skip-license` (`pnpm vsix`, Checks' `vsix` job), with
  `--target` in `release.yaml` for `linux-x64`, `linux-arm64`, `alpine-x64`, `alpine-arm64`, `darwin-x64` and
  `darwin-arm64` with their binary, and `win32-x64` and `win32-arm64` without one.
  `vsce publish --skip-duplicate --oidc` publishes through the `marketplace` environment's Trusted Publishing policy.
- **Why:** "Publish to the Marketplace with OIDC": no secrets and no Azure resources.
- **Alternatives:** "Publish to the Marketplace with OIDC": an Azure managed identity with `azure/login`. "A VSIX per
  platform, built in CI, and no universal one": a universal VSIX without the binary.

### cargo-zigbuild

- **What it is:** a cargo subcommand that links through Zig, for cross-compiling.
- **What we use:** 0.24.1 with Zig 0.17.1, from pip into a venv on one Linux runner: `cargo zigbuild --release` for
  `x86_64-unknown-linux-musl` and `aarch64-unknown-linux-musl`, static binaries for any Linux, Alpine included. Both
  macOS targets build with `cargo build` on one Apple silicon runner.
- **Why:** two runners cover the six targets that carry a binary.
- **Alternatives:** "A VSIX per platform, built in CI, and no universal one": each target on its own native runner;
  cross-compiling macOS from Linux with Zig, which needs Apple's SDK.

### bumpp

- **What it is:** a version bump tool.
- **What we use:** 12.3.0, `pnpm bump` (`bump.config.ts`): sets one version in `apps/extension/package.json` and the
  root `package.json`, commits `chore(release): bump version to ‹version›` and opens a `chore/bump-v‹version›` PR into
  dev, with no tag.
- **Why:** not recorded; "`bumpp` for version bumps" records what `pnpm bump` does.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: changesets, release-please, or `pnpm version`.

### Renovate

- **What it is:** a dependency update bot.
- **What we use:** `.github/renovate.json5`: weekly, minor and patch bumps in one `build(deps):` PR, Actions in a
  `ci(deps):` PR, a 1-day minimum release age, OSV alerts, `vscode` and `@types/vscode` moved together, Drizzle's
  `-‹hash›` builds skipped, and no abandoned-package warning for husky and portable-pty.
- **Why:** it installs the Node that `devEngines` names.
- **Alternatives:** "Renovate instead of Dependabot": Dependabot, whose container runs Node 24, so pnpm refuses to
  install. "Updates wait 1 day after a release": 7 days, then 3 days.

### GitHub CLI

- **What it is:** `gh`, GitHub's command line client.
- **What we use:** the workflows open and retitle PRs and run `gh release create v‹version› *.vsix --generate-notes`;
  the `stack` and `issue` skills open stacked PRs and file issues with `gh issue develop` branches; `gh actions-lock`
  writes `actions.lock`.
- **Why:** "Stacked PRs" and "Problems for later are GitHub issues, each with its branch" run through it.
- **Alternatives:** Not weighed in decisions.md.
  - Other options: the GitHub REST API through `actions/github-script` or `curl`.
