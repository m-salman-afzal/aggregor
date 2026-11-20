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
  call is a child span; inside a unit, every function is an `Effect.fn` const in its `make`. Finished spans and Effect
  logs go to the Aggregor App output channel, which VS Code also writes to disk. Lint bans `Effect.gen` and
  `Effect.withSpan`. Tree items, badges and the spinner run untraced. The trace shows what ran and what failed, and a
  test reads it from disk; per-row callbacks would flood it.

## `Result`, never `Option`; no `?.` or `??`

- **Decision:** a value that can be missing is a `Result`, or an effect that fails with a tagged error saying why. Lint
  bans `Option`, `?.` and `??`. The reason a value is missing is kept, as in `viewedSessionId` failing with
  `NoViewedSessionError`.

## Small functions

- **Decision:** lint caps a function at 30 lines, except a `make` that holds its unit's functions, which only gathers
  them; every function inside it stays capped. The functions read their shared state and the unit's dependencies from
  `make`. Files have no length limit since (ESLint's `max-lines` was 300), so an entity's use cases stay in one service.
  Each function does one job and shows up as its own span.
- **Solution:** `aggregor/max-lines-per-function` runs ESLint's own rule and drops its report on a class's `make`, or a
  `make<Name>` const such as a base class's `makeFor`, that holds an `Effect.fn`.
- **Alternatives considered:** helpers at module level that take their shared state as parameters, with a layer's `make`
  only creating state, starting watchers and wiring the service, which passed every helper's needs up to its callers.

## A file's errors are one class, at the top of the file that raises them

- **Problem:** every error was its own `Schema.TaggedError` class, four lines each: 82 classes in 35 files, stacked at
  the top of each file before the unit's own class. The owner wanted one class per unit to hold them.
- **Decision:** a class per file, built from one object by `TaggedErrors`, from each error's tag to its fields. Each
  error keeps its own tag and its own type, so a signature still says exactly which errors a function can fail with,
  `Effect.catchTag` still clears a handled error from the type, and each command's error-message table still fails the
  typecheck when a tag has no branch. Trace lines are unchanged, since the tags are. An interface's errors live in its
  `.interface.ts`, and every other error in the file that raises it.
- **Solution:** `TaggedErrors` in `packages/errors/src/taggedErrors.utils.ts` (`@pkg/errors`) makes a
  `Schema.TaggedError` class per key and returns them as the statics of a class to extend:
  `class ITmuxInfraServiceErrors extends TaggedErrors({TmuxSessionNotRunningError: {}, TmuxUnavailableError: {…}}) {}`.
  The class is named its file's unit or port plus `Errors` (`SessionServiceErrors`, `ITerminalInfraServiceErrors`;
  `IBaseRepositoryErrors` in `base.repository.interface.ts`, which has no class), sits after the imports and the types
  that stand alone, above the file's other class, has an empty body, and is exported only when another file uses it. Its
  keys end in `Error`, in alphabetical order, and a comment about an error sits above its key. An error is made as
  `ITmuxInfraServiceErrors.TmuxUnavailableError.make({})` and named as `ITmuxInfraServiceErrors["TmuxUnavailableError"]`
  or `ITmuxInfraServiceErrors["TmuxSessionNotRunningError" | "TmuxUnavailableError"]`. Errors take no
  `{readonly brand: unique symbol}` argument, since their tags keep them apart; entities keep theirs. Lint fails a
  `Schema.TaggedError` class in the extension's source, its tests or `@pkg/vscode`; checks that a `TaggedErrors` class
  is named `…Errors`, has an empty body and keys ending in `Error`, is the only one in its file and comes before the
  file's other classes; lets every layer and `@pkg/vscode` import `TaggedErrors`; and bans `.error.ts` files. Limits:
  `TaggedErrors` is a house helper, not an Effect API, with one type assertion inside it; it is the third plain
  top-level function, after `activate` and `deactivate`, since it builds classes when a file loads, outside any effect;
  an error's class name at run time is no longer its tag, though its `_tag` and its `name` are.
- **Alternatives considered:** each compiled under the repo's typecheck before deciding.
  - Effect 4's own form, one `Schema.TaggedError` class per unit with a `reason` field holding a `Schema.TaggedUnion` of
    the cases, handled one at a time with `Effect.catchReason`. It is built in, but a handled reason stays in the error
    type (the whole class is still in the error channel after `catchReason`), every signature says only "this unit's
    error", and every message table has to cover every reason of the class.
  - The error classes as statics of the unit's own class: does not compile (TS2506), because `make` raises the unit's
    errors inside the class's own base expression.
  - Static class expressions written by hand inside a holder class: every error is still a whole four-line class, and
    every type position becomes `InstanceType<typeof Holder.SomeError>`.
  - One class per error, at the top of its file or in `.error.ts` files: no new helper, but the stack of classes the
    owner objected to stays. For where errors live, an `errors/` folder per layer, then an `.error.ts` beside its file.

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
