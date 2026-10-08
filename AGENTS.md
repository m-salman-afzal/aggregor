# aggregor

## Working mode: you implement, the user decides

The agent writes the code; the user makes the architecture decisions (where code goes, which APIs, how a thing is
implemented). Before writing a PR's code, post its decision list with a recommended default per item and wait for the
user to approve or change it. Call out any deviation from an agreed decision when handing the work back.

Work lands as small, feature-sliced, stacked PRs: each branch starts from the previous one and its PR is retargeted with
`gh pr edit <n> --base <parent-branch>`. Merge bottom-up with merge commits, never squash. The roadmap lives in
`README.md`. Commit and push only when the user asks.

Effect here is `4.0.1`. Most Effect material online is v3 and the names differ (`Option.fromNullable` ->
`Option.fromNullishOr`, `Option` is no longer a subtype of `Effect`). Check `node_modules/effect/dist/*.d.ts` and
`node_modules/effect/ai-docs/` before using an API.

## Commands

Lint, format and type checks run from the repo root. `:check` scripts only report, `:fix` scripts write.

```bash
pnpm lint:check    # ESLint over the whole repo (--max-warnings 0); reports only
pnpm lint:fix      # Same, with --fix
pnpm format:check  # Prettier over the whole repo; reports only
pnpm format:fix    # Same, writing the changes
pnpm typecheck     # tsc --noEmit in the apps (extension, webview); packages are covered through the apps that import them
pnpm quality       # lint:check + format:check + typecheck, in parallel
pnpm lint-staged   # Same lint and format checks on staged files only (the husky pre-commit hook)
```
