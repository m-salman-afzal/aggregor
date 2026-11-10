# Decisions

What we decided, what we weighed it against, and why, in the order it happened: plans, dependencies, architecture, and
the problems we hit and how we solved them. The code, [DDD.md](DDD.md), [storage.md](storage.md) and
[AGENTS.md](AGENTS.md) say what holds now; this file says why, and what was turned down.

It follows the roadmap in [README.md](README.md): a section per milestone, in it a section per stack, and in that a
section per step, one PR each, in the order they landed. PRs outside a stack sit under "Outside a stack" in their
milestone, by date. A stack's section holds its plan: what it set out to do, what was agreed before its first step,
decisions that span its steps, and steps not built yet. A step's section says what it built and how it was checked, then
holds its decisions.

Add a decision when it is agreed, in the same commit as the code it shapes, under its step; a decision agreed before its
step's code goes into the stack's plan, and into the step's entries with the code. When a decision changes, add a new
entry in the step that changes it, with **Replaces:** naming the old one, and give the old one a **Replaced by:** line;
never rewrite or delete an old entry. Entries written before 2026-11-10 were kept current in place: each sits in the
step where it was first decided and carries its later changes inline, with their dates, and what they replaced in its
**Options**. Leave a field out rather than guess.

```markdown
#### What we decided (YYYY-MM-DD, #PR)

- **Replaces:** the entry this one replaces, by its step and title, when it replaces one.
- **Problem:** what forced a choice.
- **Options:** each one weighed, and why it lost.
- **Decision:** what we picked.
- **Why:** the reason it won.
- **Limits:** what it still doesn't cover, when that matters.
```

## Before M1: the extension's foundation (2026-05 to 2026-10-01)

Before the first milestone: a Cursor-like prototype with an ACP client and a webview chat UI (June 2026), then the pnpm
monorepo, its toolchain, CI, releases and the AI commit message button, one PR at a time (#2 to #15). There were no
stacks yet.

### Outside a stack: #2 to #15

#### Lint and format on commit (2026-05-08)

- **Decision:** ESLint (typescript-eslint, unicorn, perfectionist, import-x, promise, e18e, markdown, json, package-json
  and the local aggregor plugin) and Prettier, run on staged files by husky and lint-staged.
- **Gotcha:** lint-staged checks the index, so files moved with `git mv` and then edited must be re-staged before a
  commit.

#### Effect 4 (2026-09-08; 4.1 since 2026-10-29, #31)

- **Decision:** Effect for services, layers, typed errors, streams and tracing, on v4, whose API names differ from the
  v3 material online (`Result`, `Effect.result`, `Effect.catch`).
- **Why:** not recorded when it was added. It is what gives every function its span and every failure a typed error.

#### `@effect/tsgo` on TypeScript 7 native (2026-09-08)

- **Decision:** `@effect/tsgo` patches the TypeScript 7 native compiler (`@typescript/native`), so Effect's rules run in
  `pnpm typecheck` and in the editor through `js/ts.experimental.useTsgo`.

#### Vite bundles, vsce packages (2026-09-08)

- **Decision:** Vite builds the extension into one `dist/extension.js`; vsce packages it with `--no-dependencies`.
  Because it ships as one bundle, `presentation/` lives inside `src`.

#### pnpm workspace with pinned Node and pnpm (2026-09-24)

- **Decision:** a pnpm monorepo (`apps/extension`, `packages/*`); `devEngines` pins Node 26 and pnpm 12 with
  `onFail: error`, and CI's `pnpm/setup` installs the versions it names.

#### Releases start from merged PRs (2026-09-25, #6; 2026-11-02, #51)

- **Options:** creating a release from a pushed git tag (#4).
- **Decision:** `pnpm bump` opens a bump PR into dev; merging it opens the dev → main release PR; merging that publishes
  to the Marketplace and creates the GitHub release. Releases wait for the end of a milestone.

## M1: local Claude sessions (2026-10-08 to 2026-10-15)

From the roadmap: a Sessions sidebar that starts Claude in an editor tab and lists and focuses sessions; sessions that
survive reloads, with a closed one resuming through `claude --resume`; the cleanup before the first release (the dead
ACP, webview and React code, and `@types/vscode` aligned with `engines`); live status (running, needs input, idle,
exited), from Claude Code hooks then. The PRs were #17 to #24, none of them stacked.

### Outside a stack: #17 to #24

#### Agents run in their own terminal UIs (2026-10-08)

- **Problem:** T3 Code, Conductor and Orca each build a UI around coding agents; aggregor wants their features inside a
  normal VS Code window.
- **Options:** an ACP client with a webview chat UI (the first prototype; its dead code went in the M1 cleanup, #23); VS
  Code's chat sessions API, which is proposed and so unusable from a Marketplace extension; each agent's own TUI.
- **Decision:** each agent's native TUI (Claude Code first; Gemini CLI, OpenCode and Codex later) in a terminal opened
  as an editor tab, managed from a native TreeView.
- **Why:** VS Code already has terminals, trees, watchers, Source Control and diffs; rebuild nothing it ships, and use
  only stable APIs.

#### Review agent edits with git (2026-10-08, planned for M3)

- **Decision:** the index is the accepted baseline: staging accepts a change and restoring rejects it, in git's own diff
  with per-hunk staging. No custom diff UI.
- **Why:** same as above: Source Control and its diffs already exist.

#### Where sessions run: {local, SSH host} × {project root, git worktree} (2026-10-08)

- **Decision:** SSH is a must-have, and closing a tab must never kill the agent; tmux (M2) detaches it, and clicking the
  session reattaches.

#### Claude implements, the user decides (2026-10-08)

- **Options:** the user types while Claude guides (the earlier learning mode).
- **Decision:** Claude writes the code; the user decides where code goes, which APIs and how. Each PR starts with a
  decision list with a recommended default per item. Every commit needs the user's explicit OK, even after a stack's
  decisions are approved (2026-10-31).
- **Why:** the user owns the design and reviews each change before it is committed.

#### Commit messages come from a shell command (2026-10-08; model pinned 2026-10-26, #26)

- **Decision:** `aggregorApp.commitCommand` runs in the repository root with the staged diff on stdin and prints the
  message. The default runs `claude -p` on `claude-haiku-5-5` at low effort, with the prompt on one line and no double
  quotes so it runs the same under sh and cmd.exe.

#### Clicking a closed session resumes it (2026-10-08; `hasWorked` since 2026-11-08)

- **Options:** looking for Claude's transcript file (2026-10-08 to 2026-11-08), which only Claude has. `aggregor-pty`
  reading `hasWorked` as it starts and picking between the two argument lists it was given (2026-11-09), while VS Code
  restored session tabs after a quit by re-running the command they were opened with, which the extension never saw;
  since session tabs are transient, every tab is opened by the extension, so the pick went back to it.
- **Decision:** when tmux no longer runs the session's agent, opening it starts the agent again: the domain's
  `prepareLaunchPlan` takes the agent's `resumeArgs` (`claude --resume ‹id›`) once the session has reported `working`,
  else its `args`, which start fresh under the session's id where the agent takes one. While tmux still runs it, opening
  only attaches.
- **Why:** an agent has a conversation to resume once it has worked, and the flag is the same for every agent.

## M2: alerts, multi-project, more agents (2026-10-26 to 2026-11-10)

From the roadmap: needs-input alerts (the activity-bar badge and a notification for sessions in the background); tmux
persistence, so closing a tab detaches instead of killing the agent; projects, an extension-owned list with the tree
grouped as project › session; and agents from settings, with Claude Code, Codex, Antigravity, OpenCode and GitHub
Copilot built in and a picker on New Session. The first stacks ran here: code-health and ddd reshaped the code, then
active-project and harness-foundation built the milestone's features.

### Outside a stack: #26 to #41

#### Controllers decode VS Code arguments with a schema (2026-10-29, #32; 2026-11-03, #58)

- **Problem:** a tree view's title-bar action receives whichever row is focused. New Session from the title bar with a
  session row focused saved a session with no path, and every later read failed as corrupt.
- **Decision:** the title-bar New Session... asks for the project; every controller decodes its arguments with a schema,
  so a mismatch is logged and shown instead of reaching the service. Since 2026-11-09 the schema is the use case's
  request DTO, and a Sessions row passes its node id (`project:<path>`, `session:<id>`), which the controller decodes
  into that DTO.

#### Checks package the `.vsix` (2026-10-31, #34)

- **Problem:** vsce refuses to package when `@types/vscode` is newer than `engines.vscode`, which failed the v0.0.3
  release.
- **Decision:** Checks runs `vsix` on every branch. Renovate moves `vscode` and `@types/vscode` together with
  `rangeStrategy: bump`, and skips `vscode` patch releases, which add no API and would only lock users out.

#### Renovate instead of Dependabot (2026-10-31, #36)

- **Problem:** Dependabot's npm runs failed: its container runs Node 24, and `devEngines` (Node 26, `onFail: error`)
  makes pnpm refuse to install.
- **Decision:** Renovate (`.github/renovate.json5`), which installs the Node that `devEngines` names. Weekly, minor and
  patch bumps in one PR, OSV vulnerability alerts, GitHub Actions in their own `ci` PR, and `vscode` with
  `@types/vscode` together. husky and portable-pty are left out of the abandoned-package warning (2026-11-10): both are
  kept on purpose despite no recent release.

#### Publish to the Marketplace with OIDC (2026-10-31, #39)

- **Options:** an Azure managed identity with `azure/login` (#13).
- **Decision:** `vsce publish --skip-duplicate --oidc`, through a Trusted Publishing policy on the `marketplace`
  environment. No `main` branch rule on that environment: `release.yaml` runs on `pull_request`, whose ref is
  `refs/pull/<n>/merge`, so the rule would block publishing.
- **Why:** no secrets and no Azure resources.

#### Test builds never go into the real VS Code profiles (2026-10-31)

- **Problem:** a local `.vsix` install records `source: "vsix", pinned: true`, so VS Code ignored v0.0.4 from the
  Marketplace.
- **Decision:** test builds run only in the isolated verify profile; the real profiles install from the Marketplace.

#### Stacked PRs (2026-10-31, #41)

- **Decision:** small feature-sliced PRs on `stack/<name>/<n>/<type>/<slug>` branches, cut by the `stack` skill. Auto PR
  opens each into the branch below and joins them into a GitHub stack; the top PR lands with a merge commit, never a
  squash. Once the branches below have landed, the lowest open branch opens into dev (2026-11-05, #63).

#### No users before 0.1.0, but their data stays (2026-10-31; data kept since 2026-11-10)

- **Options:** changing stored data too, with no migrations: the old database deleted on a schema change (2026-10-31 to
  2026-11-10).
- **Decision:** rename command IDs, setting keys and storage keys, with no shims. Stored data survives every update: see
  "Every schema change is a migration on the user's database".
- **Why:** until 0.1.0 the author is the only user. Sessions moved keys four times (`sessions`, `storedSessions`,
  `savedSessions`, `agentSessions`).

### code-health (#44 to #51)

Its steps: 0 the trace log (#44), 1 fail fast (#45), 2 semantic names (#47), 3 DRY and delete (#48), 4 `Effect.fn` and
`Result` (#49), 5 small functions (#50) and 6 the version bump script (#51). Its plan wasn't written down. Decisions it
made that no single step owns come first.

#### Verify changes in a headless VS Code (2026-11-01)

- **Problem:** every visible test window interrupted the user.
- **Options:** a visible window; Xvfb, which the user turned down to stay on Wayland; mutter `--headless` on a private
  D-Bus session.
- **Decision:** the `verify-in-vscode` skill: headless mutter, driven over CDP on port 9447, reading the trace log from
  disk. Stop, UserPromptSubmit and SessionEnd hooks stop it.
- **Why:** nothing it starts may outlive the turn that started it.

#### Comments are rare and say only what the code does now (2026-11-02; rare since 2026-11-07)

- **Problem:** comments restated what well-named code already says, and described history and options not taken.
- **Decision:** a comment only where the code can't say why at a glance, such as a platform limit or a hidden
  constraint, in one line; no history, no library defaults we override, no options we didn't take. History and options
  go here instead.
- **Why:** the naming rules make code readable on its own, so comments stay a rarity.

### code-health 0: trace log (#44)

#### Every function is a traced `Effect.fn` (2026-10-31 to 2026-11-05, #44, #45, #49)

- **Problem:** a crash inside a command was lost, and failed background work was swallowed silently.
- **Decision:** every command runs as a root span named by its command ID, and every function is an `Effect.fn`, so each
  call is a child span. Finished spans and Effect logs go to the Aggregor App output channel, which VS Code also writes
  to disk. Lint bans `Effect.gen` and `Effect.withSpan`. Tree items, badges and the spinner run untraced.
- **Why:** the trace shows what ran and what failed, and a test reads it from disk; per-row callbacks would flood it.

### code-health 2: semantic names (#47)

#### Wait for the git extension before reading its API (2026-11-01, #47)

- **Problem:** the git extension may not be active yet when aggregor reads its exports.
- **Decision:** call its `activate()` and use what it returns.

### code-health 4: `Effect.fn` and `Result` (#49)

#### `Result`, never `Option`; no `?.` or `??` (2026-11-01, #49)

- **Decision:** a value that can be missing is a `Result`, or an effect that fails with a tagged error saying why. Lint
  bans `Option`, `?.` and `??`.
- **Why:** the reason a value is missing is kept, as in `viewedSessionId` failing with `NoViewedSessionError`.

### code-health 5: small functions (#50)

#### Small functions (2026-11-02, #50)

- **Decision:** lint caps a function at 30 lines. Helpers sit at module level and take their shared state as parameters;
  a layer's `make` only creates state, starts watchers and wires the service. Files have no length limit since
  2026-11-09 (ESLint's `max-lines` was 300), so an entity's use cases stay in one service.
- **Why:** each function does one job and shows up as its own span.

### code-health 6: version bump script (#51)

#### `bumpp` for version bumps (2026-11-02, #51)

- **Decision:** `pnpm bump` sets one version in the root and `apps/extension` `package.json` and pushes
  `chore/bump-v<version>`.

### ddd (#63, #55 to #62, #65)

Its steps: 1 the infrastructure layer (#63), 2 the application layer (#55), 3 Source Control in the application layer
(#56), 4 the agent client (#57), 5 the presentation layer (#58), 6 repo to project (#60), 7 layer naming (#61), 8
service span names (#59), 9 path aliases (#62) and 10 the strict Effect config (#65); #66 fixed the session domain
service after it, outside the stack. Its plan wasn't written down. Decisions that span its steps come first.

#### DDD layers: domain, application, infrastructure, presentation (2026-11-02 to 2026-11-05, #55 to #66)

- **Problem:** services called VS Code and Claude Code directly, so the use cases depended on both.
- **Decision:** four layers with dependencies pointing inward; application declares the interfaces that infrastructure
  implements, and `vscode` is imported at runtime in one file, `vscode.api.ts` (in `@pkg/vscode` since 2026-11-09).
  DDD.md has the details; `packages/eslint/src/layers/` checks imports and names.
- **Why:** a use case never depends on VS Code or on one agent.

#### Conventions are enforced by lint, not prose (2026-11-03)

- **Problem:** rules written only in AGENTS.md or DDD.md get skipped.
- **Decision:** each agreed convention gets an ESLint rule in the same PR: `no-restricted-syntax` selectors,
  `@typescript-eslint/naming-convention` per file glob, `no-restricted-imports` regexes, and the local rules in
  `packages/eslint/src/rules/`. When no installed rule can check it, write a selector rather than add a plugin.
- **Why:** lint constrains Claude better than docs do.

### ddd 6: repo to project (#60)

#### "Project", not "repo" (2026-11-03, #60)

- **Decision:** "repository" means only a DDD repository or a git repository. Lint's abbreviation rule suggests
  "project" for "repo".

### ddd 8: service span names (#59)

#### Span names are `<owner>.<const>` (2026-11-04, #59)

- **Options:** a layer prefix such as `TerminalService.openSessionTerminal` (#47).
- **Decision:** the owner comes from the file name; `pnpm lint:fix` corrects the names.
- **Why:** one search for a trace line finds the code behind it.

### ddd 9: path aliases (#62)

#### One import path per file (2026-11-05, #62)

- **Options:** a single `@/*` alias; relative imports.
- **Decision:** one alias per folder under each layer; lint rejects relative imports and `import * as`.
- **Why:** each file has one import path, and an import names what it takes.

### ddd 10: strict Effect config (#65)

#### Errors are `Schema.TaggedError`s at the top of the file that raises them (2026-11-04 to 2026-11-05, #65)

- **Options:** an `errors/` folder per layer (#55), then an `.error.ts` beside its file.
- **Decision:** an interface's errors live in its `.interface.ts`, and every other error in the file that raises it.
  Lint bans `.error.ts` files, keeps errors above a file's code and checks the `Error` suffix.

#### Every Effect diagnostic is an error (2026-11-05, #65)

- **Decision:** `@effect/tsgo` reports each Effect rule as an error in `pnpm typecheck` and the editor;
  `packages/tsconfigs/tsconfig.base.json` gives the reason for each one turned off.

### active-project (#68 to #71)

Its steps: 0 one project in view, behind a hidden anchor folder (#68), 1 session titles from the terminal (#69) and 2
settling interrupted turns (#71), which harness-foundation 3 replaced with the agent's own reports. Its plan wasn't
written down.

### active-project 0: one project in view (#68)

#### One project in view, behind a hidden anchor folder (2026-11-05, #68)

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

### active-project 1: session titles from the terminal (#69)

#### Session titles come from what the agent reports (2026-11-06, #69; from the row since 2026-11-08)

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

### Outside a stack: #66 to #76

#### Updates wait 1 day after a release (2026-11-06, #75)

- **Options:** 7 days (#36), then 3 days (#41).
- **Decision:** Renovate proposes a release once it is 1 day old, for every manager; pnpm's `minimumReleaseAgeExclude`
  list is gone.
- **Why:** a compromised release has time to be pulled, and 1 day matches pnpm's own `minimumReleaseAge` default.

#### Actions pinned to exact tags, with a lock file (2026-11-07, on `chore/add-gh-actions-lock`)

- **Options:** commit digests in the workflows, which Renovate pinned through `helpers:pinGitHubActionDigests`.
- **Decision:** workflows name exact tags (`actions/checkout@v7.0.1`), Renovate ignores the digest preset, and
  `gh actions-lock` writes each tag's commit SHA to `.github/workflows/actions.lock`.
- **Why:** the workflows stay readable while the lock file keeps the commit behind each tag.

### harness-foundation: agent foundation (#77 to #84)

Planned in `phase2.md` from 2026-11-07, and folded in here on 2026-11-10, as it was. Each step was one PR on
`stack/harness-foundation/<n>/<type>/<slug>`, stacked on the step before it. **Agreed** was settled before step 1, and
each step's **Decided** before its code; step 8 wasn't built, so its **To decide** stayed open. Each step's list was
posted for approval before its code, and its decisions also have entries of their own, written with the code, which say
more.

**Where it was meant to end up:**

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

**What the agents did when tested:**

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

**Agreed before step 1**, numbered as the steps refer to them:

**Agents as settings**

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

**Status**

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

**Alerts**

10. **State changes of a session out of view notify:** inside VS Code in the focused window, whichever workspace it
    shows, and through the OS when no VS Code window is focused. The Sessions view badge counts sessions blocked,
    errored, or finished and unseen. Which states, and how, under step 6.

**Runtime**

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

**Storage**

16. **SQLite at `~/.aggregor/aggregor.db`** (`~/.aggregor/data/aggregor.db` since step 3's review, the Aggregor folder
    moved by `AGGREGOR_HOME`), overridden by `AGGREGOR_DATA_DIR` for tests, in WAL mode, with related tables that share
    `id` (a UUID v7), `sortId`, `updatedAt` and `deletedAt`, camelCase names, and a base entity, base repository and
    base service; under step 1. The extension uses `@effect/sql-sqlite-node` 4.1.2 (Effect's client on Node's built-in
    `node:sqlite`, so no native module), with Drizzle's tables, query builder and generated migrations on top; the
    binary uses rusqlite. Today's `globalState` data is not imported. The anchor folders stay in VS Code's global
    storage.
17. **A socket later**, once the extension needs to talk to a running binary: one per session, through the interprocess
    crate.

**Process**

18. `decisions.md`, the `AGENTS.md` paragraph and this file land in step 0. Each later step adds or rewrites its own
    `decisions.md` entries and updates `README.md`, `DDD.md` and the storage ledger.
19. Each step gets its decision list approved before its code, a check in the headless VS Code, and a commit only on the
    user's OK.

**Left out of the stack:**

- OS notifications for SSH sessions: there the extension runs on the host, so it needs a helper on the local machine.
- The socket between the extension and a running binary.
- Native Windows through psmux.
- More built-ins (crush, goose, pi, grok), each one settings entry.

### harness-foundation 0: decisions ledger (in #77)

**Branch:** `stack/harness-foundation/0/chore/decisions-ledger`

- `decisions.md`: every decision so far, with its problem, options and reasons.
- `AGENTS.md`: the paragraph that makes `decisions.md` part of every change.
- `phase2.md`: this plan, linked from the roadmap in `README.md`.

**Verify:** `pnpm format:check` and the pre-commit hook.

#### Ledgers for storage and decisions (2026-10-09, 2026-11-07)

- **Decision:** `storage.md` gets an entry for anything new the extension stores: a table in its database, a file under
  `globalStorageUri`, or a key in `globalState`; this file gets every decision, kept up to date each session.
- **Why:** the user wants a running record of what the extension stores, and of each choice and its reasons.

### harness-foundation 1: SQLite storage (#77)

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

#### Projects and sessions live in SQLite (2026-11-07)

- **Problem:** `aggregor-pty` (harness-foundation 2) must write each session's status from outside VS Code, and the data
  has relations: a project has many sessions.
- **Options:** `globalState` (2026-10-09 to 2026-11-07): one JSON value per key, read-modify-written by every window,
  out of reach of other processes. A native SQLite module, which needs a build per Electron version.
- **Decision:** `~/.aggregor/data/aggregor.db` (`AGGREGOR_HOME` moves the Aggregor folder; see its entry), opened with
  `@effect/sql-sqlite-node` on Node's built-in `node:sqlite` (VS Code 1.145's Electron has Node 24.22 and SQLite
  3.53.4), in WAL mode with foreign keys on. The tables are `projects` and `sessions`, every name camelCase, defined and
  migrated through Drizzle (see its entry). Both SQL modules are unstable Effect APIs, allowed by name in
  `tsconfig.base.json`.
- **Why:** a file any process can write, real relations, and no native module to ship.

#### A base entity, a base repository and a base service (2026-11-07)

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

#### Rows are read through the entity's factory; entities don't know how they're stored (2026-11-07)

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

#### Every row has a `sortId` (2026-11-07)

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

#### Timestamps are stored as ISO 8601 text in UTC (2026-11-07)

- **Problem:** `updatedAt`, `deletedAt` and later timestamps need one stored format that the extension, `aggregor-pty`
  and a person reading the database all agree on.
- **Options:** milliseconds since the epoch as an integer: smaller, but unreadable in `sqlite3`.
- **Decision:** text such as `2026-11-07T22:13:46.836Z`: `DateTime.formatIso` in the extension, and SQLite's
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` in `aggregor-pty`, which give the same shape. Entities hold `DateTime.Utc`,
  parsed in `BaseEntity.fromRow`.
- **Why:** readable in the database, sorts in time order as text, and SQLite's date functions read it.

#### One UUID v7 id per row (2026-11-07)

- **Problem:** every table was to carry an auto-increment `id`, a random `uuid` and `createdAt`.
- **Options:** all three columns, with relations on the integer id, which collides between databases.
- **Decision:** one `id` column holding a UUID v7, the `EntityIdValueObject` every entity's id is. Its factory service,
  `entityId.domainService.ts`, makes ids (`makeEntityId`, on Effect's `SecureRandom.uuidV7`) and reads their creation
  time (`getEntityIdCreatedAt`); ids sort by creation time as text. A session's id is also its agent's session id, so
  `SessionIdValueObject` folded into it. Claude Code accepts a UUID v7 for `--session-id` (checked 2026-11-07).
- **Why:** one column gives uniqueness, creation order and creation time, and stays unique across machines.

#### Drizzle on Effect defines the tables, builds the queries and generates the migrations (2026-11-08)

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
    into `apps/extension/assets/migrations/`, committed and shipped in the VSIX without drizzle-kit's snapshots, one per
    schema change (see "Every schema change is a migration on the user's database").
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

#### One project list for every window (2026-11-08)

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

#### Listed projects are `ProjectListItemDto`s (2026-11-07; a DTO since 2026-11-09)

- **Problem:** a workspace folder is listed before its project has a row, so a listed project can't be the stored
  `ProjectEntity`.
- **Decision:** `ProjectService.listProjects` returns `ProjectListItemDto`s (path, name, isAdded), built from the
  workspace folders and the added projects; a project's row is made the first time it is added or given a session. Until
  2026-11-09 these were `ListedProjectValueObject`s, but a project identified by its path is no value object.

#### Names say what a thing is to the user (2026-11-08)

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

### harness-foundation 2: the `aggregor-pty` binary (#78)

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

#### `aggregor-pty` runs each agent and records its status (2026-11-08)

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

#### Rust for `aggregor-pty`, checked like the TypeScript (2026-11-08)

- **Decision:** edition 2024, the toolchain pinned to 1.99.1 in `apps/pty/rust-toolchain.toml`, `rustfmt.toml` at
  Prettier's 120 columns. `apps/pty` is a pnpm workspace package, so `pnpm pty:check` (`cargo fmt --check` and
  `cargo clippy -D warnings`) runs in `pnpm quality`, `pnpm pty:test` runs the tests, and the pre-commit hook runs
  `rustfmt --check` on staged `.rs` files. `.vscode/settings.json` points rust-analyzer at the crate. The extension's
  `build:pty` copies the host build to `apps/extension/bin/`, which `compile`, `package` and the `verify-in-vscode`
  skill run.
- **Why:** one command checks the whole repo, and the end-to-end test builds its database from the extension's
  migrations, so a schema change that breaks the binary fails its test.

#### A VSIX per platform, built in CI, and no universal one (2026-11-08; no universal VSIX since 2026-11-10)

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

### harness-foundation 3: status from OSC 7501 (#80)

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

#### Windows see outside writes by polling `data_version`, and read only the rows written (2026-11-08)

- **Problem:** `aggregor-pty` and other windows write the database, and a window has to notice within a moment and know
  which rows changed, without keeping a copy to compare against.
- **Options:** re-reading when the window regains focus (2026-11-07 to 2026-11-08), which misses every status change
  while you look at the window. Watching the WAL file, which a checkpoint recreates and which doesn't exist before the
  first write. A socket from the binary, planned for later (harness-foundation, Agreed 17). Re-reading every row into a
  copy per window on each change (step 3's first build), which the view then diffed. A change counter column kept by a
  trigger: exact and immune to the clock, but a column and triggers on every table.
- **Decision:** each repository's change feed (`entityChange.utils.ts`) looks again when `PRAGMA data_version` moves,
  read every 250 ms, untraced, which only another connection's commit does, and right after each of the window's own
  writes. A look reads the rows whose `updatedAt` is at or after the latest one it read, soft-deleted ones too, skips
  those it already read unchanged at that same millisecond, and calls a row placed when its `sortId` is above every one
  it saw (new, or moved; `added` until 2026-11-10), removed when it has `deletedAt`, else updated. It publishes each as
  an `EntityChange`, whose kind is `EntityChangeKindValueObject` (`ENTITY_CHANGE_KINDS`); a failed look leaves the
  cursor where it was.
- **Why:** one small query per write, no copy of the data, and a status shows within a quarter second. A clock that
  steps back could hide a write until the row's next one; the counter column is the fix if that ever shows.

#### Rows show the status on the session's row (2026-11-08)

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

#### Each status has a row badge (2026-11-08)

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

#### The backend drives the Sessions view (2026-11-08; DTOs and presenters since 2026-11-09)

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

#### Presentation talks to use cases in DTOs (2026-11-09)

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

#### A command's failure is shown by its presenter (2026-11-09)

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

#### `@pkg/vscode` holds what presentation and infrastructure share (2026-11-09)

- **Problem:** `VsCodeApi` and the vscode helpers sat in infrastructure, but views and the middleware need them too.
- **Decision:** a workspace package, `packages/vscode`: `VsCodeApi` (the one runtime `vscode` import),
  `acquireScopedDisposable`, `streamVsCodeEvent`, `setWhenClauseContextKey`, `runWithProgressIndicator`,
  `openAggregorSettingsInSettingsEditor`, `showErrorNotificationWithoutWaiting`, and `decodeVsCodeArgument` (formerly
  `decodeCommandArgument`). Lint applies the extension's code rules to it. The helpers were `acquireDisposable`,
  `fromEvent`, `setContext`, `withProgress`, `openSetting` and `showErrorInBackground` until 2026-11-09, which named the
  gesture rather than what each one does.
- **Why:** presentation imports nothing from infrastructure, and the shared code has one home.

#### Constants live in `@pkg/constants`, split by feature (2026-11-09; every constant since 2026-11-10, #98)

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

#### Aggregor keeps its files in one folder, `~/.aggregor` (2026-11-09)

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

### harness-foundation 4: agents from settings, and the picker (#81)

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

#### Agents are settings entries (2026-11-03, #57; settings since 2026-11-09)

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

#### New Session asks which agent, among those installed (2026-11-09)

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

#### A gear in the Sessions title bar opens Aggregor's settings (2026-11-09)

- **Options:** a controller, `SettingsService` and an `ISettingsConfig` call, so every command takes the same path.
- **Decision:** **Open Settings** (`aggregorApp.openSettings`, `$(gear)`) after Add Project opens the Settings editor at
  `@ext:<extension id>`. `routes.ts` registers it straight to `openAggregorSettingsInSettingsEditor` in `@pkg/vscode`,
  with `presentAppCommandError`, the presenter for commands that cannot fail.
- **Why:** it reads and writes no data, and presentation already opens settings itself for an error's Open Settings
  button.

#### The session in front stays selected in the Sessions view (2026-11-09)

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

#### A session's tab shows its row's name (2026-11-09)

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

#### A type sits below what it is built from (2026-11-09)

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

#### The ESLint setup lives in `@pkg/eslint` (2026-11-09)

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

#### Every dependency version lives once, in the pnpm catalog (2026-11-09)

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

### harness-foundation 5: tmux sessions (#82)

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

#### Every session's agent runs in tmux (2026-11-09)

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

#### Codex resumes its own conversation by id (2026-11-09)

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

### harness-foundation 6: session alerts (#83)

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

#### Sessions out of view notify, and the view's badge counts those waiting on you (2026-11-10)

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

#### The CLIs a session runs are agents, one word everywhere (2026-11-10)

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

#### A set of values is an enum value object that exports its values (2026-11-10)

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

### harness-foundation 7: Aggregor's workspace, saved without asking (#84)

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

#### Aggregor's workspace is a file Aggregor writes (2026-11-10; an offer to save it from 2026-11-06, #68)

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

### harness-foundation 8: session tasks (not built)

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

### Outside a stack: #85 to #107

#### PR titles are commit subjects with a feature scope, plus the stack's step (2026-11-10, on `chore/bump-deps`)

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

#### Drizzle updates only to its releases (2026-11-10)

- **Problem:** drizzle publishes a build of each branch commit as `<version>-<hash>`, which semver ranks above the
  release itself. Renovate (#89) moved drizzle-orm and drizzle-kit from `1.0.0-rc.5` to `1.0.0-rc.5-ab785fc`, a build
  from 2026-08-11 whose types fail typecheck with `anyUnknownInErrorContext` and which pulled in esbuild.
- **Decision:** both stay on `1.0.0-rc.5`, and a Renovate rule skips any drizzle version ending in `-<7-char hash>`
  (`allowedVersions: "!/-[0-9a-f]{7}$/"`). esbuild's `allowBuilds` entry (#91) goes with it, since nothing installs
  esbuild any more.

#### Projects and sessions move up and down (2026-11-10)

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

#### The F5 build keeps its own Aggregor folder, `~/.aggregorDev` (2026-11-10, #98)

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

#### Problems for later are GitHub issues, each with its branch (2026-11-10)

- **Problem:** problems put off for later sat in `decisions.md`'s Limits, `phase2.md`'s notes, the README and code
  comments, where nothing tracked them and a new conversation had to find them again.
- **Options:** a problems list in the repo, which is one more ledger to keep current; issues without branches.
- **Decision:** when the user asks for an issue, the `issue` skill (`.claude/skills/issue`) files it on GitHub with what
  was reported, what might have gone wrong, how it was checked and the proposed solution, labelled `bug`, `enhancement`
  or `help wanted`, then makes its branch with `gh issue develop` from `dev`, linked to the issue and pushed, without
  checking it out. The problems put off so far became #99 to #105.
- **Why:** GitHub tracks them in one place, each one says enough to start on it cold, and its branch is ready.

#### The shown project's own settings sync with Aggregor's workspace file (2026-11-10)

- **Problem:** in a workspace with several folders, VS Code reads a folder's `.vscode/settings.json` only for settings
  scoped to a resource, and Aggregor's workspace always has two, the anchor folder and the project. Every other setting
  in a project's own file was ignored, VS Code's and every extension's, `aggregorApp.commitCommand` included. The other
  way round, VS Code and extensions write a window's "workspace" settings into the workspace file, so an edit that lands
  in the project's own file when the project is open alone, such as Peacock's color, never reached it.
- **Options:** scoping Aggregor's commit settings to a resource and reading them with the project's folder, which fixes
  those two alone. Opening each project as a plain folder, which reloads the window on every switch. Keeping the last
  copy in the database, a table, repository and migration for one JSON value. Writing through VS Code's settings API,
  one write per key, which refuses the keys of extensions that aren't installed. A one-way copy written straight to the
  file (the first version, the same day): it replaced Peacock's color with the project's on the next switch, its write
  raced VS Code's own save of the folder swap ("File Modified Since", a compare-or-overwrite prompt, and the swap timing
  out), and with two colors in play Peacock's writes traded them back and forth every second.
- **Decision:** `WorkspaceInfraService` syncs the shown project's `.vscode/settings.json` with the `settings` of
  `~/.aggregor/anchor/Aggregor.code-workspace`, both ways, against the last copy, which `copiedProjectSettings.json`
  beside the workspace file keeps with its project's path. A setting changed in the project's file since then takes the
  project's value; one changed only in the workspace file is written into the project's file, alone, with its comments
  and indentation kept, and the project's file wins when both changed. With no last copy of the project, its settings
  replace the workspace file's. Each sync writes the project's file first, then the workspace file, then the last copy,
  so a failure, such as the project's file having unsaved changes in an editor, leaves the edits for the next one. Both
  files are written through VS Code's own copy of them (`openTextDocument`, one edit for the whole text, then a save),
  which its settings writes and every extension's share, so none of them finds the file changed under it. A sync runs
  when the window starts, on every settings change VS Code makes, when the folders change and when the shown project's
  own `.vscode/settings.json` changes, one at a time behind a lock that a switch holds too. A switch syncs the leaving
  project, copies the next one's settings in before its folder, so an extension that reads them as the folders change,
  as Peacock does, finds them already there, then swaps the folder and syncs again. The first switch, which writes the
  workspace file anew, syncs the last copy's project first. String values starting with `./` or `../` become absolute
  paths in the project, and `${workspaceFolder}` and `${workspaceFolderBasename}` its path and name; a relative path
  written in the workspace file goes into the project's file relative to the project. Files are parsed and edited with
  `jsonc-parser` (3.3.1, Microsoft's, as VS Code uses). A window showing several projects syncs nothing.
- **Why:** the workspace level takes every setting but application- and machine-scoped ones, VS Code applies a change to
  the file without a reload, and edits land where they would with the project open alone, so the project's own settings
  work as then, Peacock included. Writing through VS Code's copy and in turns keeps every writer from racing another.
- **Limits:** a string that starts with `./` or `../` but isn't a path is made one too. An extension that rewrites its
  own settings whenever they change, as Peacock does, can still be caught mid-write by a switch; copying the next
  project's settings in first leaves it one value to apply. A switch while the leaving project's file has unsaved
  changes drops that project's pending workspace edits. A workspace the user saved with the anchor folder at folder 0
  isn't synced, since its settings are the user's.

## M3: worktrees and review (from 2026-11-10)

From the roadmap: worktree mode, a session in the project root or in a new git worktree; changed files under each
session, opening git's diff with per-hunk staging; archiving the sessions you are done with, removing the worktree and
keeping unmerged branches; bookmarks; and creating or linking a pull request from a session.

### m3: data that survives updates, then archived sessions

Planned on 2026-11-10. The milestone's first change to the database, archiving sessions, made the user's data the first
concern: until then a schema change regenerated the one migration and deleted the database. Step 0 makes every schema
change a migration that runs on the user's database, tested; step 1 backs the database up before it migrates; step 2
archives sessions. Step 1 also gathered this file by milestone, stack and step, with `phase2.md` folded in.

### m3 0: every migration tested (`stack/m3/0/chore/migration-tests`)

`pnpm db:generate --name <change>` writes each schema change's migration, which the extension runs on the user's
database when it starts; vitest runs the migration test (`pnpm test`), and `pnpm db:check` fails when a model changed
without its migration, both in CI.

**Verified (2026-11-10):** the tests; throwaway migrations, as its entry says; and the extension migrating a new
database in the headless VS Code.

#### Every schema change is a migration on the user's database (2026-11-10)

- **Problem:** before 0.1.0 a schema change regenerated the one migration from zero and deleted the old database, so an
  update that changed the schema lost every project and session. The installed build's database held 7 sessions and 4
  projects when archiving sessions first needed a column.
- **Options:**
  - Regenerating and deleting until 0.1.0.
  - Checking migrations only by hand, against a copy of a real database.
  - Node's own test runner, with no new dependency: it can't resolve the extension's tsconfig aliases, so it would run
    Drizzle's migrator directly instead of ours. `@effect/vitest`, whose every export `@effect/tsgo` reports as an
    unstable API.
  - `drizzle-kit check` in CI: it checks the migrations folder, not that the models match it.
- **Decision:**
  - A migration per schema change, run on the user's database when a window starts; no database is deleted. A release's
    migration only adds; renaming or dropping a column takes two releases; a migration that moves data adds its SQL and
    its own check; a released migration is never edited (`DDD.md`'s Tables and migrations).
  - `applyPendingMigrations` (`database.utils.ts`) runs a folder's pending migrations, split out of `DatabaseLayer` so a
    test runs the same code on any folder.
  - vitest 5.1.0 runs `apps/extension/tests` (`pnpm test`); `vitest.config.ts` resolves the tsconfig aliases, and each
    test runs its effect with `Effect.runPromise`.
  - `migrations.test.ts` runs every migration on a new database. For each migration it builds a database at that one,
    fills every table from SQLite's own description of it, migrates it to the newest, and checks that every table, row
    and value is still there, that new columns hold their defaults, that `integrity_check` and `foreign_key_check` are
    clean, and that a second run changes nothing. Throwaway migrations that dropped a column, deleted rows, changed
    values, broke a reference or filled a new column each failed it; one that added a column and one drizzle-kit wrote
    to rebuild a table each passed.
  - `pnpm db:check` runs `drizzle-kit generate` into a copy of the migrations and fails when it writes one, so a model
    can't change without its migration. CI runs both.
  - Before a release with a migration, the build runs against a copy of a real database (`AGGREGOR_DATABASE_FILE`).
- **Why:** an update must never cost the user their sessions. The test needs no data written for each migration, so
  every future migration is checked from every earlier one, which also covers a user who skipped updates.

#### One column per dimension (2026-11-10)

- **Problem:** archiving sessions would have added another boolean column to `sessions`. The user asked whether flags
  such as `hasWorked` and an archived flag should become one status column, a state machine, and for a rule to follow
  from now on.
- **Options:**
  - One stage column holding `hasWorked`, archived and the like: they change independently, so it would need a value per
    combination (28, with the agent's 7 statuses), and `aggregor-pty` and the extension would both write it.
  - A lint banning boolean columns: whether a flag is a stage takes judgement, which a lint can't make.
- **Decision:** `DDD.md`'s Tables and migrations. A column per thing that changes on its own, with one writer. A stage
  is one enum column even with two values; each action checks the stage it starts from, the row's context value carries
  the stage, and a transition map comes with a third value. Booleans about one thing merge into its stage column. A
  boolean column is for a yes-or-no fact that isn't a stage. Nothing merges today: `status` is already a stage column
  with its details beside it, and `hasWorked` and `isAdded` are such facts.
- **Why:** a stage column keeps the states and the actions each allows in one place without multiplying them, and one
  writer per column keeps `aggregor-pty`'s writes and the extension's apart.

### m3 1: a backup before migrating (`stack/m3/1/feat/database-backup`)

`applyPendingMigrations` copies the database beside itself before an update's migrations change it, and this file was
gathered by milestone, stack and step.

**Verified (2026-11-10):** the migration test with a throwaway migration, through `VACUUM INTO` and, with that forced to
fail, through the file copy; and the headless VS Code on a copy of the installed build's database (14 sessions, 4
projects), whose backup kept every row at the old schema while the migrated database gained the new column.

#### The database is backed up before it migrates (2026-11-10)

- **Problem:** a migration that passes the migration test can still lose something the test didn't foresee, and the user
  would have no way back to their projects and sessions.
- **Options:**
  - Copying the database file alone: it misses writes still in the write-ahead log, which held 3.4 MB beside a 28 KB
    file in the installed build's database.
  - Keeping every backup; failing to start, or migrating at once, when `VACUUM INTO` fails.
  - For two windows starting at once: each writing its backup under a temporary name and linking it into place only when
    none exists. An Effect lock (a `Semaphore`) only orders fibers inside one window's extension host, and each window
    is its own process.
  - For the second connection: `SqliteClient.layer` through `Effect.provide`, which the Effect rules reject outside an
    entry point (`strictEffectProvide`); `node:sqlite` itself, the driver under Effect's client (built first, the same
    day), which left that one query outside Effect's client and its trace.
- **Decision:**
  - `applyPendingMigrations` backs up an existing database that has migrations to run, inside the migrations'
    transaction, before them. That transaction's `BEGIN IMMEDIATE` holds SQLite's write lock, so a second window waits
    for the first one's backup and migrations, up to the client's 5-second busy timeout, and then finds nothing to run.
  - `VACUUM INTO data/aggregor.before-<first pending migration>.db`, on a second, read-only connection, Effect's own
    (`SqliteClient.make`, given a `Reactivity` of its own, a module `tsconfig.base.json` now allows by name): `VACUUM`
    can't run inside a transaction, and a reader still sees the database from before the migrations. When it fails, the
    database file and its write-ahead log are copied instead; nothing else commits while the lock is held. When that
    fails too, a warning is logged and the migrations still run, in their transaction.
  - A backup of the same name, left by a migration that failed, is replaced; older backups are deleted once a new one is
    written.
  - The migration test checks that the backup holds every row from before and replaced the older one, and that a
    database with nothing to run writes none. Forcing `VACUUM INTO` to fail, with a throwaway migration, showed the copy
    holding the same rows.
  - Going back is by hand, written in `storage.md`.
- **Why:** an update must never cost the user their sessions, and SQLite's own write lock is the one lock every window
  and `aggregor-pty` already share.
- **Limits:** a backup that takes longer than the busy timeout makes a second window starting at once fail to start
  until it reloads. The file-copy path isn't covered by a test that runs every time.

#### Decisions are kept by milestone, stack and step (2026-11-10)

- **Replaces:** this file's rule until 2026-11-10, one entry per topic under Product, Working process, Architecture and
  code rules, Dependencies and tooling, CI and releases, and VS Code and agent integration, rewritten in place when its
  decision changed; and `phase2.md`, the harness-foundation stack's plan.
- **Problem:** what was chosen and turned down sat in two places, the topic entries and one stack's plan in `phase2.md`,
  and an entry rewritten in place kept its earlier forms only in its Options. M3 had no plan file at all.
- **Options:** keeping the topic sections and adding a milestone and step to each entry's heading, which finds a topic's
  current decision fast but tells nothing in the order it happened. A plan file per stack, `phase3.md` and on, which
  keeps two places.
- **Decision:** this file is the one place. A section per milestone, in it one per stack and per PR outside a stack, and
  in a stack one per step, in the order they landed. A stack's section holds its plan; a step's says what it built and
  how it was checked, then its entries. `phase2.md` is folded in whole, its goals, the agents' tests, what was agreed,
  each step's changes, decisions and checks, and what it left out, and deleted. A changed decision is a new entry with
  **Replaces:**, and the old one gets **Replaced by:**. The entries kept current in place before stay where they were
  first decided, with their later changes inline. The README's roadmap, `AGENTS.md` and the `issue` skill point here.
- **Why:** everything chosen and turned down, and why, in one file, in the order it happened. What holds now is already
  in `DDD.md`, `storage.md` and `AGENTS.md`.

### m3 2: archived sessions (`stack/m3/2/feat/archive-sessions`)

**Agreed (2026-11-10), before its code:**

1. **Archive, not Done.** The sessions you are done with move to an Archive section, out of the Sessions list. Done was
   the first word for it, but `done` already names a turn that finished while you looked elsewhere; a first plan renamed
   that status to `finished` in a step of its own, which Archive doesn't need.
2. **The sections are views.** The Aggregor view container holds two views, Sessions and Archive, each a pane that
   collapses and resizes on its own, as Source Control's Repositories, Changes and Graph do. Archive starts collapsed,
   an empty Archive says what goes there, and the container is named Aggregor, so its header doesn't read Sessions above
   a Sessions pane. Turned down: two collapsible group rows in one tree, which lose the panes' resizing and title
   buttons and put every row a level deeper.
3. **Archiving stops the agent.** Archive in a session row's … menu closes the session's tab and stops its agent; the
   row and the agent's conversation stay. It asks first only while a turn runs (working, or waiting on you). Turned
   down: moving the row with the agent left running. Removing the session's worktree joins it once worktrees exist.
   **Replaced by:** m3 2's "Archiving asks whether to keep the agent running" (2026-11-11).
4. **An archived session opens where it is.** Clicking an Archive row opens the session, resuming its conversation as
   for an exited one, and it stays archived; Unarchive in its menu moves it back to the end of its project's sessions.
   Turned down: a click that also moves it back.
5. **Archive groups by project,** as Sessions does. Turned down: one flat list, newest at the top, with each session's
   project beside it.
6. **An archived session is a session like any other:** it alerts, archiving's own exit included (a condition for that
   is left for later), counts in the activity-bar badge, shows its status and moves up and down among its project's
   archived sessions. Turned down: leaving archived sessions out of the alerts and the badge, a condition in each.
7. **Archive's rows:** a project row has no buttons, so nothing starts a project or a session there; a session row's
   menu has Move Up, Move Down, Rename, Unarchive and Remove. **Replaced by:** m3 2's "Agents stop from the session,
   project and view menus" (2026-11-11), for the project row's … menu with Stop Agents.
8. **Storage:** a `lifecycle` column, `ongoing` or `archived` and `ongoing` by default, behind an enum value object
   (`SESSION_LIFECYCLES`), as "One column per dimension" asks. Archiving and unarchiving also place the session at the
   end of the order, so the change feed reads it as placed and both views redraw its project, and Archive lists sessions
   in the order they were archived. Its migration, `add_session_lifecycle`, is the first one a user's database runs.
   Turned down: an `isDone` boolean; a `doneAt` timestamp, whose write arrives as a plain update that redraws only the
   row.
9. **Code:** the session entity's `lifecycle` and its column; `archiveSession`, `unarchiveSession` and the archived
   sessions' list in `session.service.ts`, whose project lists and move flags follow the lifecycle; an Archive view of
   its own in `presentation/views/` that draws its rows with `createSessionTreeItem`, while the status badges stay with
   the Sessions view's provider, which draws them in both; the commands `aggregorApp.archiveSession` (Archive) and
   `aggregorApp.unarchiveSession` (Unarchive).

Built (2026-11-11) as agreed: the sessions table's `lifecycle` column and its migration, the first a user's database
runs; Archive and Unarchive in the session rows' menus; and the Archive view under Sessions, in a container now named
Aggregor. The entries below are what was decided while building it.

**Verified (2026-11-11):** the migration test, which runs the new migration on a filled database at `create_tables`,
keeps every row, finds `lifecycle` at its default and the backup holding the rows from before; `pnpm pty:test`, whose
database runs the extension's migrations; and the headless VS Code. There, a copy of the installed build's database (16
sessions, 5 of them removed, and 4 projects) migrated with its backup beside it and every row unchanged; archiving an
exited session, then a second, Move Down and Unarchive in the Archive, and an empty Archive's text; on a running Claude
session, Archive with no question while idle, which closed its tab and stopped its agent; opening it from the Archive,
which resumed it and left it there; and Archive while working, which asked, kept it on Cancel and archived it on
Archive.

#### The views ask for archived sessions by name (2026-11-11)

- **Problem:** the Archive view needs its own lists, and a view needs to tell an archived session from another, but
  presentation can't import the domain's `SESSION_LIFECYCLES`.
- **Options:** a lifecycle field in the list requests, which the views would fill with a value the domain owns; the
  session list item's lifecycle value object, which the views would compare with that same value.
- **Decision:** `listArchivedProjectSessionIds` and `listProjectsWithArchivedSessions` in `session.service.ts`, beside
  `listProjectSessionIds`, which now lists only the ongoing sessions; `isArchived` on `SessionListItemDto`; and the
  controllers' `…ForArchiveView` functions, one per read.
- **Why:** each view asks for what it shows, and the lifecycle stays the backend's.

#### The Archive lists the listed projects, and redraws whole (2026-11-11)

- **Problem:** Archive groups by project, but which projects, and how it redraws when a project gets its first archived
  session: the Sessions view redraws that project's row, which the Archive doesn't have yet.
- **Options:** every project with an archived session, listed or not, which would show a removed project's archived
  sessions while its others stay hidden; redrawing one project's row, which misses a project row that arrives or goes.
- **Decision:** the projects the Sessions view lists, workspace folders and added ones, that have an archived session,
  in the list's order. A session's own change redraws its row, and any other change the whole tree.
- **Why:** a project hides its archived sessions as it hides its others, and the tree is small enough to draw whole.

#### Archiving asks while the agent works or waits on an answer (2026-11-11)

- **Problem:** Agreed 3 asks before archiving "while a turn runs (working, or waiting on you)", but waiting on you, as
  the view's badge counts it, also covers a failed turn and a finished one not yet seen, where nothing is cut short.
- **Decision:** it asks while `isSessionTurnRunning`: working, or blocked on a permission, a question or a sign-in. The
  question names the session and says its agent is in the middle of a turn and will be stopped.
- **Why:** those are the turns stopping the agent cuts short.
- **Replaced by:** "Archiving asks whether to keep the agent running" (2026-11-11).

#### The Archive view leaves out the Sessions view's extras (2026-11-11)

- **Problem:** the Sessions view also takes drops, keeps the session in front selected and turns the working spinner.
- **Decision:** the Archive has Move Up and Move Down in its menu but no drag and drop, and keeps nothing selected; the
  Sessions view skips an archived session in front, whose row it doesn't have, rather than retrying its reveal. The
  Sessions view's badge provider draws the Archive rows' badges.
- **Why:** none of them was asked for, and each can come with its own step if it is missed.
- **Limits:** the spinner turns only while the Sessions pane is visible, so a working archived session's spinner stops
  while that pane is collapsed.

#### A stack's bottom branch doesn't track dev (2026-11-11)

- **Problem:** m3 0 was cut with `git switch -c … origin/dev`, which made it track `origin/dev`, so its push went
  straight to `dev`: no PR, no GitHub stack, and a subject without a scope on `dev`.
- **Options:** unsetting the upstream after cutting; pushing only with an explicit branch name.
- **Decision:** the stack skill cuts the bottom with `git switch --no-track -c`, so its first push gives it its own
  upstream (`push.autoSetupRemote`).
- **Why:** one flag where the branch is cut, rather than a step to remember at every push.

**Verified again (2026-11-11), after the stop commands:** in the headless VS Code, the menus: Stop Agent on a session
row only while its agent runs, in both views; Stop Agents on project rows in both views, alone on the Archive's; Stop
All Agents in both views' title … menus. Archiving a running Claude session asked in the quick pick, and Keep Agent
Running archived it with its tab closed and its tmux session alive; Stop All Agents in the Archive asked and stopped it;
opening it from the Archive started it again; Remove asked in the quick pick and kept it on Escape; Stop Agent asked and
stopped it. Not exercised: the mid-turn wording, and a project's Stop Agents, which runs the same code as the others.

#### Archiving asks whether to keep the agent running (2026-11-11)

- **Replaces:** m3 2's Agreed 3, "Archiving stops the agent", and its entry "Archiving asks while the agent works or
  waits on an answer".
- **Problem:** stopping the agent on Archive cuts a running turn short, and the user wants the turn to finish and to
  decide when the agent exits.
- **Options:** archiving with the agent left running and nothing asked; stopping it, as before.
- **Decision:** with its agent running, Archive asks whether to keep it running, first so that Enter keeps it, or stop
  it; Cancel or Escape leaves the session where it is. Its tab closes either way: a kept agent runs on in tmux, finishes
  its turn and opens again from the Archive. With no agent running, it asks nothing.
- **Why:** the user decides when they archive, and nothing is cut short unless they choose it.

#### Agents stop from the session, project and view menus (2026-11-11)

- **Replaces:** m3 2's Agreed 7, "Archive's rows", for the project row, which now has a … menu with Stop Agents.
- **Problem:** with Archive keeping agents running, the user needs to stop them: one, a project's, or a whole view's.
- **Options:** inline stop buttons on the rows; a stop for one session only.
- **Decision:** Stop Agent in a session row's … menu while its agent runs, in both views; Stop Agents in a project row's
  … menu, for that project's sessions in that view, now on every project row in both views; Stop All Agents in each
  view's title … menu, for the sessions that view lists. Each asks every time, naming how many agents stop and how many
  of them are mid-turn, and closes the stopped sessions' tabs. They are five commands, since a title or project menu
  doesn't tell its command which view it is in.
- **Why:** each scope stops from where it is shown, and asking every time keeps a stop from being a slip.
- **Limits:** each stopped agent raises its own exited alert, as Agreed 6 left it, so Stop All Agents raises one per
  agent.

#### Questions are asked in VS Code's quick pick (2026-11-11)

- **Problem:** the confirmations were modal warnings, which VS Code draws as a system dialog, outside the window, under
  its default `window.dialogStyle`.
- **Options:** a notification with buttons, which can be missed and closes on its own; changing `window.dialogStyle`,
  the user's setting for every extension.
- **Decision:** `IUserInputPromptInfraService.askQuestion` replaces `confirm`: a quick pick titled with the question, a
  row per answer with a line on what it does, then Cancel. Cancel, Escape or a click outside fails with
  `QuestionCancelledError`, which the use cases take as no. Remove's question uses it too.
- **Why:** it opens inside the window, takes the keyboard as the agent and project pickers do, and can't be lost.

#### Constants hold no logic (2026-11-11)

- **Problem:** some constants chose their text: `SESSION_NOTICES`' stop and archive lines on agent and turn counts, the
  tmux and aggregor-pty errors on what was found, the row tooltip on whether the agent left a message. A choice in a
  text file is out of sight of the code that makes it, and none of its cases reads as a whole sentence.
- **Options:** no functions in constants at all, with `{placeholder}` texts filled by a formatter, which TypeScript
  can't check.
- **Decision:** a constant is a literal, or a text with holes: an arrow whose whole body is one template literal. A text
  that depends on a case is one constant per case, and a util beside the code that uses it picks one: the presenter for
  an error's message, `application/utils/sessionQuestion.utils.ts` (`@applicationUtils`, a new alias) for the stop and
  archive questions, `sessions.utils.ts` for the tooltip. `CONSTANT_BANS` in `syntaxBans.ts` bans conditions, calls,
  spreads and operators in `@pkg/constants`, and any other function there. Archive's Stop Agent line is now the one Stop
  Agent uses, which it repeated word for word.
- **Why:** each text reads whole where it is kept, and each choice sits with the code that makes it.

#### Match on tags; no switch or else (2026-11-11)

- **Problem:** code branched on a tagged value by comparing `_tag`, as in the Sessions and Archive trees' node kinds and
  their change kinds, so a new kind would fall through an `if` unnoticed.
- **Options:** banning `if` and ternaries for `Match` everywhere, which makes early returns and two-way choices longer
  and checks nothing more; a cap on branches per function (`complexity`, at ESLint's default 20 now).
- **Decision:** lint bans comparing `_tag` (use `Match.valueTags`, or `Match.value` and `Match.exhaustive` for a table
  of cases), `switch` and `else`; ESLint already bans nested ternaries. The 17 comparisons are now `Match`, and the stop
  question's four lines are a `Match` table on one agent or several and a turn running or not. An `if` that returns
  early and a ternary stay.
- **Why:** a tag without a branch fails the typecheck, and the code keeps the early-return shape it already has.

#### Components are listed in components.md (2026-11-11)

- **Problem:** what Aggregor is built on (tmux, aggregor-pty and its crates, SQLite, Effect, Drizzle, the build and
  release tools) was spread across decisions.md entries, with no one place saying what part of each is used.
- **Options:** keeping it in decisions.md only, which is ordered by when things were decided, not by component.
- **Decision:** `components.md` lists every component by where it runs (the user's machine, inside the extension,
  building and checking, releasing): what it is, what part we use, why, and the alternatives, naming the decisions.md
  entry that weighed them. A component no entry weighed says so, and its other options are marked as not weighed.
  decisions.md keeps the full reasoning; `AGENTS.md` asks for components.md to change in the same commit as the use.
- **Why:** a component's use and its reason read in one place, without walking the decision history.

#### Menu items start with a glyph (2026-11-11)

- **Problem:** the … menus are text only, and the user wants to tell their items apart at a glance.
- **Options:** codicons (`$(archive) Archive`), which VS Code drops from menu items; inline icon buttons on the rows,
  which crowd them; emoji such as 🗑, drawn in colour and wider than the rest.
- **Decision:** every menu item's title starts with a plain Unicode glyph, so the items stay in line: ∧ Move Up, ∨ Move
  Down, ■ Stop Agent, Stop Agents and Stop All Agents, ✎ Rename, ⤓ Archive, ⤒ Unarchive, ✕ Remove and Remove Project. An
  em space (`\u2003` in the manifest) follows the glyph: HTML doesn't collapse it, as it does a run of plain spaces. The
  commands are hidden from the Command Palette, so the glyphs show only in the menus.
- **Why:** the menu font draws them as text, in both themes, with nothing to bundle.
- **Limits:** a screen reader reads each glyph's name before the item; ∧ ∨ are the logical and and or signs, chosen
  because they match each other's size and line, which ⌃ ⌄ and ˄ ˅ don't; ⤓ ⤒ are thin; and the glyphs differ in width,
  so the words after them start a few pixels apart.
