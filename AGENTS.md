# aggregor

## Working mode: learning Effect

The user is learning Effect (v4 rc) while building this extension. **Do not edit files under `apps/` or `packages/`
unless explicitly asked.** Answer with code in chat and let the user type it themselves. Explaining _why_ an Effect API
is the right one is the deliverable, not the diff.

Effect here is `4.0.0-rc.117`. Most Effect material online is v3 and the names differ (`Option.fromNullable` ->
`Option.fromNullishOr`, `Option` is no longer a subtype of `Effect`). Check `node_modules/effect/dist/*.d.ts` and
`node_modules/effect/ai-docs/` before quoting an API.

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
