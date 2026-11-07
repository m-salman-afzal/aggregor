# Decisions

What we decided, what we weighed it against, and why: dependencies, architecture, and the problems we hit and how we
solved them. The code, [DDD.md](DDD.md) and [globalstorage.md](globalstorage.md) say what is there now; this file says
why.

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

### Comments say only what the code does now (2026-11-02)

- **Decision:** one or two lines on why; no history, no library defaults we override, no options we didn't take. History
  and options go here instead.

### Ledgers for storage and decisions (2026-10-09, 2026-11-07)

- **Decision:** `globalstorage.md` gets an entry for anything new kept in `globalStorageUri` or `globalState`; this file
  gets every decision, kept up to date each session.
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
  implements, and `vscode` is imported at runtime in one file, `vscode.api.ts`. DDD.md has the details;
  `eslint.layers.ts` checks imports and names.
- **Why:** a use case never depends on VS Code or on one agent.

### Agents sit behind a harness interface (2026-11-03, #57)

- **Decision:** Claude Code's launch, status and title code lives in `ClaudeCodeHarnessInfraService`, behind
  `IHarnessInfraService`. Use cases reach a session's harness by its `harnessId`, and the terminal runs the launch plan
  the harness returns.
- **Why:** Gemini CLI, OpenCode and Codex (M4) become more harnesses, not changes to the use cases.

### "Project", not "repo" (2026-11-03, #60)

- **Decision:** "repository" means only a DDD repository or a git repository. Lint's abbreviation rule suggests
  "project" for "repo".

### No users before 0.1.0 (2026-10-31)

- **Decision:** rename command IDs, setting keys and storage keys, and change stored data, with no migrations or shims.
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
  a layer's `make` only creates state, starts watchers and wires the service.
- **Why:** each function does one job and shows up as its own span.

### Controllers decode VS Code arguments with a schema (2026-10-29, #32; 2026-11-03, #58)

- **Problem:** a tree view's title-bar action receives whichever row is focused. New Session from the title bar with a
  session row focused saved a session with no path, and every later read failed as corrupt.
- **Decision:** the title-bar New Session... asks for the project; every controller decodes its arguments with a schema,
  so a mismatch is logged and shown instead of reaching the service.

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

## VS Code and agent integration

### Sessions live in `globalState` (2026-10-09; per project since 2026-10-26, #27)

- **Decision:** sessions are stored in `globalState`, shared by every window, and re-read on window focus. Each window
  lists its projects and the sessions under them, so it never shows sessions from unrelated workspaces.

### Clicking a closed session resumes it (2026-10-08)

- **Decision:** when the session's Claude transcript exists, the tab runs `claude --resume`; otherwise it starts fresh.

### Live status from Claude Code hooks (2026-10-09, #24)

- **Decision:** the extension passes hooks with `--settings`; they write status files the extension watches.
  Screen-based status waits for a later agent that has no hooks.

### An interrupted turn settles to idle (2026-11-06, #71)

- **Problem:** Claude runs no Stop hook when the user interrupts a turn, so the session stayed running.
- **Decision:** once the terminal title has shown Claude's idle mark for a few seconds, the session settles to idle.

### Session titles come from the agent's terminal title (2026-11-06, #69)

- **Options:** read Claude's transcript (the earlier build; Orca and cmux read OSC titles and the transcript); generate
  a title with an LLM, as T3 Code and Conductor do.
- **Decision:** session terminals open without a name, so the tab shows the agent's OSC title; the extension reads
  `Terminal.name` every second, since no change event exists. One rule in `getSessionTitle` strips leading symbols,
  spaces and control characters for every harness, and each harness lists only its placeholder titles. Rename stores a
  `customName`, which wins in the row and the tab.
- **Why:** one rule covers every agent's title, and a harness adds only data.

### One project in view, behind a hidden anchor folder (2026-11-05, #68)

- **Problem:** with every project a workspace folder, Explorer, search, file watching and Source Control span all of
  them, and git watches each repository recursively. Changing workspace folder 0 restarts every extension; only VS
  Code's own Agents window is exempt.
- **Options:** swap folder 0 on each switch, restarting every extension each time; an extension-owned anchor at
  folder 0.
- **Decision:** the first switch puts a hidden anchor folder (`globalStorage/anchors/<window key>/Aggregor`) at folder 0
  and the viewed session's project at folder 1; later switches swap only folder 1. That first switch restarts the
  extensions once. Session terminals carry `AGGREGOR_SESSION_ID` in their env, so they are found again after the
  restart, and the anchor's `terminal.integrated.cwd` makes New Terminal open in the shown project.
- **Why:** one restart instead of one per switch. TypeScript, ESLint, Prettier, rust-analyzer and Lua all follow the
  shown project; mise needs `mise.selectWorkspaceFolder` after each switch.

### Added projects live in `globalState`, keyed by window (2026-11-05)

- **Problem:** adding a second folder turns the window into an untitled workspace with an empty `workspaceState`.
- **Options:** `workspaceState` (#27), which loses the list at that switch.
- **Decision:** added projects live in `globalState` under the window's key, so they survive that switch.

### Offer once to save the workspace as Aggregor (2026-11-06, #68)

- **Problem:** an unsaved multi-root workspace is named Untitled and asks to be saved when the window closes, and no API
  saves one silently.
- **Decision:** after the first switch, offer once to save it. The anchor folder is named `Aggregor`, so the dialog
  suggests `Aggregor.code-workspace` and the window takes that name.

### Wait for the git extension before reading its API (2026-11-01, #47)

- **Problem:** the git extension may not be active yet when aggregor reads its exports.
- **Decision:** call its `activate()` and use what it returns.
