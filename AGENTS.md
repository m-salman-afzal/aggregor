# aggregor

## Working mode: you implement, the user decides

The agent writes the code; the user makes the architecture decisions (where code goes, which APIs, how a thing is
implemented). Before writing a PR's code, post its decision list with a recommended default per item and wait for the
user to approve or change it. Call out any deviation from an agreed decision when handing the work back.

Work lands as small, feature-sliced, stacked PRs on `stack/<name>/<n>/<type>/<slug>` branches, each starting from the
one below it. The `stack` skill (`.claude/skills/stack`) creates them; on push, the Auto PR workflow opens each PR into
the branch below and joins them into a GitHub stack. Land a stack by merging its top PR with a merge commit, never
squash. The roadmap lives in `README.md`. Commit and push only when the user asks.

Effect here is `4.1.0`. Most Effect material online is v3 and the names differ (`Option.fromNullable` ->
`Option.fromNullishOr`, `Option` is no longer a subtype of `Effect`). Check `node_modules/effect/dist/*.d.ts` and
`node_modules/effect/ai-docs/` before using an API.

## Engineering rules

- **YAGNI.** Don't build anything until you need it.
- **DRY.** Extract a pattern after its second duplication, not before.
- **Fail fast.** Explicit errors beat silent failures.
- **Delete aggressively.** Less code means fewer bugs.
- **Semantic naming.** Name variables, parameters, functions and APIs with verbose, self-explanatory names that optimize
  for comprehension by both humans and LLMs, not brevity: `sessionId`, not `id`; `stagedDiff`, not `diff`. The commit
  message code in `apps/extension/src/services/scm` is the reference.
- **No users before 0.1.0.** Until 0.1.0 ships, the author is the only user. Be brave: rename command IDs, setting keys
  and storage keys, change stored data without migrations, and leave no compatibility shims or deprecation paths.

## Traces

Every command runs as a root span named by its command ID, and each `Effect.fn` it calls is a child span. Finished spans
and Effect logs go to the **Aggregor App** output channel, one trace-level line per span:
`aggregorApp.newSessionInRepo > newSession > startSession 3.1ms ok`. F5 starts the extension at trace level; elsewhere,
pick it with **Developer: Set Log Level...**. VS Code also writes the channel to
`<logs>/window<n>/exthost/SalmanAfzal.aggregor-app/Aggregor App.log`, so a test run's trace can be read from disk.
Callbacks VS Code makes per row or per spinner frame (tree items, badges, the spinner) run untraced.

## Commands

Lint, format and type checks run from the repo root. `:check` scripts only report, `:fix` scripts write.

```bash
pnpm lint:check    # ESLint over the whole repo (--max-warnings 0); reports only
pnpm lint:fix      # Same, with --fix
pnpm format:check  # Prettier over the whole repo; reports only
pnpm format:fix    # Same, writing the changes
pnpm typecheck     # tsc --noEmit in the apps (extension); packages are covered through the apps that import them
pnpm quality       # lint:check + format:check + typecheck, in parallel
pnpm lint-staged   # Same lint and format checks on staged files only (the husky pre-commit hook)
```
