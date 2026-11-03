# aggregor

## Working mode: you implement, the user decides

The agent writes the code; the user makes the architecture decisions (where code goes, which APIs, how a thing is
implemented). Before writing a PR's code, post its decision list with a recommended default per item and wait for the
user to approve or change it. Call out any deviation from an agreed decision when handing the work back.

Work lands as small, feature-sliced, stacked PRs on `stack/<name>/<n>/<type>/<slug>` branches, each starting from the
one below it. The `stack` skill (`.claude/skills/stack`) creates them; on push, the Auto PR workflow opens each PR into
the branch below and joins them into a GitHub stack. Land a stack by merging its top PR with a merge commit, never
squash. The roadmap lives in `README.md`. Commit and push only when the user asks.

## Engineering rules

- **YAGNI.** Don't build anything until you need it.
- **DRY.** Extract a pattern after its second duplication, not before.
- **Fail fast.** Explicit errors beat silent failures.
- **Delete aggressively.** Less code means fewer bugs.
- **Semantic naming.** Name variables, parameters, functions and APIs with verbose, self-explanatory names that optimize
  for comprehension by both humans and LLMs, not brevity: `sessionId`, not `id`; `stagedDiff`, not `diff`. The commit
  message code in `apps/extension/src/application/scm` and `infrastructure/clients/commit-cli` is the reference.
- **No users before 0.1.0.** Until 0.1.0 ships, the author is the only user. Be brave: rename command IDs, setting keys
  and storage keys, change stored data without migrations, and leave no compatibility shims or deprecation paths.

## Architecture

`DDD.md` holds the planned layering (domain, application, infrastructure, presentation) and the stack that moves the
code there. Read it before deciding where code goes, and update it when a step lands or the plan changes.

## Effect

Effect here is `4.1.0`. Most Effect material online is v3 and the names differ (`Either` is now `Result`,
`Effect.either` is `Effect.result`, `Effect.catchAll` is `Effect.catch`). Check `node_modules/effect/dist/*.d.ts` and
`node_modules/effect/ai-docs/` before using an API.

- **Every effectful function is an `Effect.fn`**, which gives it its span. Error handling and other combinators go in
  `Effect.fn`'s extra arguments after the body, not in a `.pipe`; handling that only one caller needs gets its own small
  `Effect.fn`. A layer's body is a named `Effect.fn` such as `makeTerminalClientOnVsCode`, passed to `Layer.effect`.
  `.pipe` is only for what is not a function: layers, streams and schedules. Lint bans `Effect.gen` and
  `Effect.withSpan`.
- **No `?.` and no `??`.** Check the value explicitly, or take a default with `Result.getOrElse` or `UndefinedOr.match`.
  Lint bans both.
- **`Result`, never `Option`.** A value that can be missing is a `Result`, or an effect that fails, whose tagged error
  says why it is missing. Turn an `Option` that an Effect API returns into a `Result` right there with
  `Result.fromOption`. Lint bans importing `Option`.
- **Small functions.** Give each function one job, so each shows up as its own span; lint caps a function at 30 lines.
  Functions sit at module level and take the state they share (refs, VS Code handles) as parameters. A layer's `make`
  function only creates that state, starts its watchers and wires up the service.
- **Short, true comments.** One or two lines on why. Update or delete a comment in the same change as its code.

## Traces

Every command runs as a root span named by its command ID, and each `Effect.fn` it calls is a child span. Name an
`Effect.fn` after the function it defines; one that belongs to a service or view gets that name in front:
`TerminalClient.openSessionTerminal`. Finished spans and Effect logs go to the **Aggregor App** output channel, one
trace-level line per span:
`aggregorApp.newSessionAskingForRepo > newSession > startSession > openNewSessionTerminal > TerminalClient.openSessionTerminal 1.0ms ok`.
Work a layer starts in the background, such as a watcher, nests under that layer's `make` span. F5 starts the extension
at trace level; elsewhere, pick it with **Developer: Set Log Level...**. VS Code also writes the channel to
`<logs>/window<n>/exthost/SalmanAfzal.aggregor-app/Aggregor App.log`, so a test run's trace can be read from disk.
Callbacks VS Code makes per row or per spinner frame (tree items, badges, the spinner) run untraced.

## Commands

Lint, format and type checks run from the repo root. `:check` scripts only report, `:fix` scripts write.

```bash
pnpm lint:check    # ESLint over the whole repo (--max-warnings 0); reports only
pnpm lint:fix      # Same, with --fix
pnpm format:check  # Prettier over the whole repo; reports only
pnpm format:fix    # Same, writing the changes
pnpm typecheck     # tsc --noEmit in the apps and .claude's scripts; packages are covered through the apps importing them
pnpm quality       # lint:check + format:check + typecheck, in parallel
pnpm lint-staged   # Same lint and format checks on staged files only (the husky pre-commit hook)
pnpm bump          # On an up-to-date dev: pick the next version; pushes chore/bump-v<version> and opens its PR
```

To release, run `pnpm bump` (`bump.config.ts`). Merging the bump PR into dev opens the release PR, dev into main
(`release-pr.yaml`); merging that one publishes to the Marketplace and creates the GitHub release (`release.yaml`). The
bump sets the same version in the root and `apps/extension` `package.json`.
