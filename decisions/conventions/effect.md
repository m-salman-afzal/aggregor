# Effect

How the extension uses Effect.

## Effect 4

- **Decision:** Effect for services, layers, typed errors, streams and tracing, on v4, whose API names differ from the
  v3 material online (`Result`, `Effect.result`, `Effect.catch`). Not recorded when it was added. It is what gives every
  function its span and every failure a typed error.

## `@effect/tsgo` on TypeScript 7 native

- **Decision:** `@effect/tsgo` patches the TypeScript 7 native compiler (`@typescript/native`), so Effect's rules run in
  `pnpm typecheck` and in the editor through `js/ts.experimental.useTsgo`.

## Every function is a traced `Effect.fn`

- **Problem:** a crash inside a command was lost, and failed background work was swallowed silently.
- **Decision:** every command runs as a root span named by its command ID, and every function is an `Effect.fn`, so each
  call is a child span. Finished spans and Effect logs go to the Aggregor App output channel, which VS Code also writes
  to disk. Lint bans `Effect.gen` and `Effect.withSpan`. Tree items, badges and the spinner run untraced. The trace
  shows what ran and what failed, and a test reads it from disk; per-row callbacks would flood it.

## `Result`, never `Option`; no `?.` or `??`

- **Decision:** a value that can be missing is a `Result`, or an effect that fails with a tagged error saying why. Lint
  bans `Option`, `?.` and `??`. The reason a value is missing is kept, as in `viewedSessionId` failing with
  `NoViewedSessionError`.

## Small functions

- **Decision:** lint caps a function at 30 lines. Helpers sit at module level and take their shared state as parameters;
  a layer's `make` only creates state, starts watchers and wires the service. Files have no length limit since (ESLint's
  `max-lines` was 300), so an entity's use cases stay in one service. Each function does one job and shows up as its own
  span.

## Errors are `Schema.TaggedError`s at the top of the file that raises them

- **Decision:** an interface's errors live in its `.interface.ts`, and every other error in the file that raises it.
  Lint bans `.error.ts` files, keeps errors above a file's code and checks the `Error` suffix.
- **Alternatives considered:** an `errors/` folder per layer, then an `.error.ts` beside its file.

## Every Effect diagnostic is an error

- **Decision:** `@effect/tsgo` reports each Effect rule as an error in `pnpm typecheck` and the editor;
  `packages/tsconfigs/tsconfig.base.json` gives the reason for each one turned off.

## Match on tags; no switch or else

- **Problem:** code branched on a tagged value by comparing `_tag`, as in the Sessions and Archive trees' node kinds and
  their change kinds, so a new kind would fall through an `if` unnoticed.
- **Decision:** lint bans comparing `_tag` (use `Match.valueTags`, or `Match.value` and `Match.exhaustive` for a table
  of cases), `switch` and `else`; ESLint already bans nested ternaries. The 17 comparisons are now `Match`, and the stop
  question's four lines are a `Match` table on one agent or several and a turn running or not. An `if` that returns
  early and a ternary stay. A tag without a branch fails the typecheck, and the code keeps the early-return shape it
  already has.
- **Alternatives considered:** banning `if` and ternaries for `Match` everywhere, which makes early returns and two-way
  choices longer and checks nothing more; a cap on branches per function (`complexity`, at ESLint's default 20 now).
