# aggregor

## Working mode: you implement, the user decides

The agent writes the code; the user makes the architecture decisions (where code goes, which APIs, how a thing is
implemented). Before writing a PR's code, post its decision list with a recommended default per item and wait for the
user to approve or change it. Call out any deviation from an agreed decision when handing the work back.

`decisions.md` records every decision: the problem, the options weighed, what was picked and why, dependencies included.
It is the one place for them and for each stack's plan, by milestone, stack and step, in the order they happened; there
are no separate plan files. Add each one once it is agreed, in the same commit as the code it shapes, under its step; a
changed decision is a new entry that names the one it replaces. Before a session's last hand-back, check that every
decision the session made, or changed, is there.

Work lands as small, feature-sliced, stacked PRs on `stack/<name>/<n>/<type>/<slug>` branches, each starting from the
one below it. The `stack` skill (`.claude/skills/stack`) creates them; on push, the Auto PR workflow opens each PR into
the branch below and joins them into a GitHub stack. Land a stack by merging its top PR with a merge commit, never
squash. A problem left for later is a GitHub issue with a branch for its fix linked to it, which the `issue` skill
(`.claude/skills/issue`) files when the user asks for an issue. The roadmap lives in `README.md`. Commit and push only
when the user asks.

A commit subject is `<type>(<scope>): <subject>`, with `!` before the colon for a breaking change, and its scope is a
feature from the list in `.github/workflows/pr-title.yaml`. Auto PR titles each PR with its first commit's subject, plus
`[<name> <n>]` on a stack branch, and the PR Title workflow fails any title in another form. When a PR adds a feature
that no scope covers, add its scope in that PR, to `pr-title.yaml` and with what it covers to the commit prompt in
`.vscode/settings.json`.

## Engineering rules

- **YAGNI.** Don't build anything until you need it.
- **DRY.** Extract a pattern after its second duplication, not before.
- **Fail fast.** Explicit errors beat silent failures.
- **Delete aggressively.** Less code means fewer bugs.
- **Semantic naming.** Name variables, parameters, functions and APIs with verbose, self-explanatory names that optimize
  for comprehension by both humans and LLMs, not brevity: `sessionId`, not `id`; `stagedDiff`, not `diff`. The commit
  message code in `application/services/commitMessage.service.ts` and `infrastructure/services/commitCli` is the
  reference. Name a thing by what it is to the user, not by the gesture that reached it (`chosenProject`, not
  `clickedProject`), and give each word one meaning: a "prompt" is an LLM's, so asking the user is a user-input prompt
  (`IUserInputPromptInfraService`).
- **No users before 0.1.0, but their data stays.** Until 0.1.0 ships, the author is the only user. Be brave: rename
  command IDs, setting keys and storage keys, and leave no compatibility shims or deprecation paths. Stored data is the
  exception: every schema change is a new migration (`pnpm db:generate --name <change>`) that runs on the user's
  database when the app updates, and no database is deleted. `DDD.md`'s Tables and migrations has the rules a column and
  a migration follow.

## Architecture

`DDD.md` holds the layering (domain, application, infrastructure, presentation): where each kind of code goes, its
names, and the lint that checks them. Read it before deciding where code goes, and update it in the same commit as a
change that moves where code goes. Each file's suffix names its role (`.entity.ts`, `.interface.ts`, `.infraService.ts`
and so on), and `@pkg/eslint` (`packages/eslint`) checks each layer's imports, the names each role requires, and where
types and interfaces live. Code imports through one alias per folder under a layer (`@entities/`, `@interfaces/`,
`@infraServices/` and so on, listed in `apps/extension/tsconfig.json`), never through a relative path, and by name,
never with `import * as`. Every constant outside the domain lives in its feature's `@pkg/constants` file, grouped in a
labelled object with the constants it belongs with (see `DDD.md`). Enforce a new convention with a lint there, not only
with prose here.

## Effect

Effect here is `4.1.0`. Most Effect material online is v3 and the names differ (`Either` is now `Result`,
`Effect.either` is `Effect.result`, `Effect.catchAll` is `Effect.catch`). Check `node_modules/effect/dist/*.d.ts` and
`node_modules/effect/ai-docs/` before using an API.

- **Every Effect rule is an error in the extension source.** `@effect/tsgo` checks them in `pnpm typecheck` and the
  editor; `packages/tsconfigs/tsconfig.base.json` lists each rule, and one turned off says why there.
- **Every function is an `Effect.fn`**, which gives it its span, even one that only builds a stream, so the trace shows
  it ran. Lint checks every top-level function in the extension source; one nested in an `Effect.fn` is its callback.
  The exceptions carry an `eslint-disable` with the reason: the trace log's formatters, which run while a span ends, and
  `activate`. Error handling and other combinators go in `Effect.fn`'s extra arguments after the body, not in a `.pipe`;
  handling that only one caller needs gets its own small `Effect.fn`. A layer's body is a named `Effect.fn` such as
  `makeTerminalInfraService`, passed to `Layer.effect`. A service member that takes no arguments is an `Effect`, not a
  function: `make` calls its `Effect.fn` once (`readSettings: readSettings(getConfiguration)`), and every run still gets
  its own span. `.pipe` is only for what is not a function: layers, streams and schedules. Lint bans `Effect.gen` and
  `Effect.withSpan`.
- **No `?.` and no `??`.** Check the value explicitly, or take a default with `Result.getOrElse` or `UndefinedOr.match`.
  Lint bans both.
- **`Result`, never `Option`.** A value that can be missing is a `Result`, or an effect that fails, whose tagged error
  says why it is missing. Turn an `Option` that an Effect API returns into a `Result` right there with
  `Result.fromOption`. Lint bans importing `Option`.
- **Small functions.** Give each function one job, so each shows up as its own span; lint caps a function at 30 lines.
  Functions sit at module level and take the state they share (refs, VS Code handles) as parameters. A layer's `make`
  function only creates that state, starts its watchers and wires up the service.
- **Comments are rare.** Names say what code does, so a comment appears only where the code can't say why at a glance: a
  platform limit, a workaround, a constraint that isn't visible. One true line; update or delete it with its code.

## Traces

Every command runs as a root span named by its command ID, and each `Effect.fn` it calls is a child span. A span is
named `<owner>.<const>`: the owner comes from the file name (`session.service.ts` is `SessionService`'s), a helper file
belongs to the one owner in its folder, a layer's `make<Owner>` is `<Owner>.make`, and a file with no owner gives the
bare const name. `aggregor/span-name` (`packages/eslint/src/rules/`) checks every name, and `pnpm lint:fix` corrects it.
Finished spans and Effect logs go to the **Aggregor App** output channel, one trace-level line per span:
`aggregorApp.openSession > SessionController.openChosenSession > SessionService.openSession > TerminalInfraService.focusSessionTerminal 0.8ms failed: TerminalNotFoundError`.
Work a layer starts in the background, such as a watcher, nests under that layer's `make` span. F5 starts the extension
at trace level, with its data in `~/.aggregorDev` (`AGGREGOR_HOME` in `.vscode/launch.json`), apart from the installed
extension's `~/.aggregor`; elsewhere, pick it with **Developer: Set Log Level...**. VS Code also writes the channel to
`<logs>/window<n>/exthost/SalmanAfzal.aggregor-app/Aggregor App.log`, so a test run's trace can be read from disk.
Callbacks VS Code makes per row or per spinner frame (tree items, badges, the spinner) run untraced.

## Dependencies

Every dependency version lives once, in `pnpm-workspace.yaml`'s `catalog:`; each `package.json` names it as `"catalog:"`
(workspace packages stay `workspace:*`). Change versions only there or with `pnpm add` / `pnpm remove`:
`catalogMode: strict` makes `pnpm add` write the catalog entry, and `cleanupUnusedCatalogs` drops entries nothing uses.
ESLint (`pnpm/json-enforce-catalog`) fails any other version, and `pnpm lint:fix` moves a plain one into the catalog.
`@types/vscode` is the exception: vsce reads its version to check `engines.vscode` and fails on `catalog:`, so it stays
a version in `apps/extension` and `packages/vscode`.

## Commands

Lint, format and type checks run from the repo root. `:check` scripts only report, `:fix` scripts write.

```bash
pnpm lint:check    # ESLint over the whole repo (--max-warnings 0); reports only
pnpm lint:fix      # Same, with --fix
pnpm format:check  # Prettier over the whole repo; reports only
pnpm format:fix    # Same, writing the changes
pnpm typecheck     # tsc --noEmit in the apps, the root config files and .claude's scripts; packages are covered through the apps
pnpm pty:check     # cargo fmt --check and cargo clippy -D warnings on apps/pty, the aggregor-pty binary
pnpm pty:test      # aggregor-pty's tests, the end-to-end one included
pnpm test          # The extension's tests (vitest, apps/extension/tests), the migration test among them
pnpm quality       # lint:check + format:check + typecheck + pty:check, in parallel
pnpm lint-staged   # Same lint and format checks on staged files only (the husky pre-commit hook)
pnpm db:generate   # After changing a table model, with --name <change>: drizzle-kit writes its migration
pnpm db:check      # Fails when a table model changed without its migration; reports only
pnpm --filter=aggregor-app build:pty  # Builds aggregor-pty for this machine into apps/extension/bin
pnpm bump          # On an up-to-date dev: pick the next version; pushes chore/bump-v<version> and opens its PR
```

To release, run `pnpm bump` (`bump.config.ts`). Merging the bump PR into dev opens the release PR, dev into main
(`release-pr.yaml`); merging that one publishes to the Marketplace and creates the GitHub release (`release.yaml`): a
VSIX per platform, Linux and macOS ones with their `aggregor-pty`, and no universal one. The bump sets the same version
in the root and `apps/extension` `package.json`.
