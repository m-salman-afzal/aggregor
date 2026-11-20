# Dependency injection

Which layer is given what, the units that yield it, the levels they merge into, and the order they start.

## Each port's implementation is given only what it is built from

- **Problem:** `app.layer.ts` was one chain of `Layer.provideMerge`, which builds each layer with every layer below it
  in reach and hands all of them on. A repository was built with the commit CLI in reach, presentation held the SQL
  client and Node's file system, and only lint kept the layers apart.
- **Decision:** an implementation closes its own dependencies, in its own file, with `Layer.provide`, which hides them
  from whoever uses it. `VsCodeApi` and the trace log are the only globals: `activate` builds `VsCodeApi` from its
  argument, and the trace log sits under everything so that startup is traced. What a layer is built from reads beside
  the code that uses it, and nothing above a layer can reach what is under it.
- **Solution:** each `infrastructure` layer that reads a platform service ends in `.pipe(Layer.provide(...))` with
  `NodeServices.layer`, `DatabaseLayer` or the utils it yields; `SessionsPageUtils` does the same for the `SecureRandom`
  its page's nonce needs, and `DomainLayer` is given `SecureRandom` for the entity ids. No implementation needs another
  port, so `app.layer.ts` puts them side by side with `Layer.mergeAll` and checks the result against
  `Layer.Layer<never, unknown, VsCodeApi>`: one that leaves anything else open fails the typecheck. Effect shares a
  layer by its value, so `DatabaseLayer`, named by `BaseRepository` and its utils, is one connection and one run of the
  migrations. An application service leaves its ports and `Path` open, and `ApplicationLayer` is given them where the
  levels meet.
- **Alternatives considered:** Node's services provided once at the root, as before, which is fewer lines and leaves the
  file system and the process spawner in reach of every layer. One Node layer per service (`NodePath.layer`,
  `NodeFileSystem.layer`), which is closer, but each is an unstable API that `allowedUnstableApis` would have to list,
  and the child process spawner needs the other two. Closing each implementation in `di/`, away from the code that reads
  what it is given.

## Startup order is a dependency, never a position

- **Problem:** the chain built its layers strictly bottom-up, so a layer could lean on an earlier one having run without
  saying so. Layers side by side are built at the same time.
- **Decision:** a layer that must start after another is given it with `Layer.provide`, or runs after it in the same
  effect. The order is then in the graph or the code, where it can be read, and a layer with no such edge is free to
  start whenever.
- **Solution:** `BaseRepository`, which every table's repository builds on, is given `DatabaseLayer`, which is the SQL
  client with its migrations already run. `BackgroundJobs`' `make` runs `syncSessionTabsWithTmux` before the other jobs,
  since they read the session in view as they start, and the commands and views are given all of `ApplicationLayer`, so
  every job has started before a command or view exists.
- **Alternatives considered:** keeping the chain for its order, which hides which of its fifteen steps matter.

## A unit is an Effect service class that yields what it needs once

- **Problem:** everything was provided to everything at the top, in `app.layer.ts` and `extension.ts`, and a use case
  that yielded a port put that port on the type of every caller, up to the controller and the command. Helpers took
  services, refs and `…Dependencies` objects as parameters, so a helper's needs were passed down by hand. No part said
  what it needed; it only got everything.
- **Decision:** each part is given only what it needs, as NestJS segregates its modules, in the form Effect's docs give
  a service: a `Context.Service` class whose `make` yields the unit's dependencies once, at its top, and holds every
  function of the unit as a const, with a static `layer` built from `make`. A function inside `make` yields no service
  and takes none as a parameter, so nothing a unit does needs anything from its caller: a caller's type lists the unit,
  not what the unit uses. State, such as a `Ref` or a cache, lives in the `make` of the unit whose functions own it, and
  another unit that needs it calls that unit's members.
- **Solution:** a class is `Context.Service<X>()("<key>", {make: Effect.fn("make")(function* () { … })})` with
  `public static readonly layer = Layer.effect(this, ownSpans("X", this.make()))`; a member that takes no arguments is
  an `Effect`, built once in `make`. A port's implementation is a class too, named as its port without the `I`, whose
  layer provides the port, `Layer.effect(IPort, ownSpans("<Owner>", this.make()))`; the port class stays in
  `application/interfaces` or `domain/entities`, and nothing yields the implementation class itself.
- **Alternatives considered:** a unit's dependencies passed to its functions as parameters, which the user turned down
  outright. Module-level functions bound to their dependencies by helper files (a `.module.ts` per feature and two
  helpers of our own were drafted), dropped as a pattern Effect's docs do not use.

## Every file that holds functions is a unit

- **Problem:** with units in place, each file still needed a call on whether it became a class.
- **Decision:** every file that holds functions exports one `Context.Service` class, and every function is a const
  inside its `make`, with no exception that could be avoided. That covers application services, controllers, error
  messages, domain services, `.utils.ts` files (`@pkg/vscode`'s `VscodeUtils` among them), the GitHub CLI transformer,
  views and `BackgroundJobs`, whose `make` returns `{}` since nothing calls it, port implementations, the base classes,
  the command middleware and the layer files that hold functions. It is one rule with no judgement in it, and a helper
  that is a unit stops passing its needs up to its callers. A long `make` is accepted, and a class is divided where its
  parts clearly belong apart, as a judgement, not a rule. What is left is not a unit because it cannot be one:
  - `activate` and `deactivate` in `extension.ts`, which VS Code calls directly.
  - `ownSpans` (`packages/trace/src/ownSpans.utils.ts`), which every class's `static layer` line calls outside any
    effect, so it cannot be a service that is yielded.
  - `TaggedErrors` (`packages/errors/src/taggedErrors.utils.ts`), which builds a file's errors class when the file
    loads, outside any effect, so it cannot be an `Effect.fn` inside a `make`.
  - A file that holds only definitions: value objects, entities, DTOs, ports, table models and types.
- **Solution:**
  - `BaseService` and `BaseRepository` each have one member, `makeFor`, which binds a repository or an entity table and
    returns the base functions through `ownSpans`, so they keep `BaseService` and `BaseRepository` as owner. A service
    or repository yields the class at the top of its `make`, calls `makeFor` there, and its layer provides the base
    class's layer.
  - `RegisterCommandMiddleware` has one member, `registerCommand`; a controller yields it and its layer provides it.
    Since `ownSpans` keeps the caller's owner on a callback handed to a unit, a command handler's spans stay its
    controller's.
  - `BackgroundJobs`, `Database` and `TraceLog` are the classes of the layer files that held functions; `DatabaseLayer`
    and `TraceLogLayer` are still exported, built from their class's members, and the trace log's formatters are
    closures inside `TraceLog`'s `make`.
  - Lint allows a `Context.Service` class in every role that holds functions and bans it in a definition file, bans a
    top-level `Effect.fn` in `apps/extension/src` and `packages/vscode/src` with no exemption, and bans a parameter
    named or typed `…Dependencies` everywhere. `aggregor/max-lines-per-function` exempts a class's `make`, or a
    `make<Name>` const such as `makeFor`, that holds `Effect.fn`s, while every function inside it stays capped at 30
    lines.
- **Alternatives considered:** plain functions for the parts that need nothing, which needs a call per file that lint
  cannot make, and leaves a helper that later needs a port to pass it up to every caller. A view as a layer with no
  class, a top-level `make<Owner>View` passed to `Layer.effectDiscard`, since nothing calls it: dropped, as one form for
  every file that holds functions is simpler to read and to lint than a second shape for the files nothing calls. The
  same shape for port implementations, a top-level `make<Owner>` with an exported layer const, dropped for the same
  reason. Exceptions for the middleware, which stayed top-level functions so its spans kept the calling controller's
  mark, until `ownSpans` kept a callback's caller; for `makeBaseService(repository)` and
  `makeBaseRepository(entityTable)`, build-time factories generic over what they bind, now each a class's `makeFor`; and
  for the layer files and the trace log's formatters. The user wanted the rule with no exception that could be avoided.

## Each level is merged under its own span, and given the levels below where they meet

- **Problem:** once every part closes what it is built from, the levels still have to meet somewhere, and the trace log
  should show which level a slow or failing layer belongs to.
- **Decision:** each level is one `Layer.mergeAll`, under a span named for the level, so startup nests under one span
  per level. A unit's own layer gives it the units of its own level that it yields; what comes from the levels below is
  given where the levels are put together, and each level is closed before the next gets it, so a level never hands on
  what it was given.
- **Solution:** `app.layer.ts` holds `DomainLayer`, given `SecureRandom`; `InfrastructureLayer`, given `DomainLayer` and
  `VscodeUtils.layer`; and the exported `ApplicationLayer`, given `DomainLayer`, `InfrastructureLayer` and
  `NodeServices.layer`. `extension.ts` holds `PresentationLayer`, the controllers and views, given `ApplicationLayer`
  and `VscodeUtils.layer`: `@pkg/vscode` sits below infrastructure and presentation, so no unit provides it on its own
  layer. `TraceLogLayer`, under everything, provides `VscodeUtils.layer` itself, and the one layer value is built once.
  Each is `Layer.mergeAll(...).pipe(Layer.withSpan("<Level>"), Layer.provide(...))`; lint fails a `Layer.mergeAll` in
  `di/` or `extension.ts` without its span, and any `Layer.provideMerge` in `app.layer.ts` or `extension.ts`.
  `SessionController.layer` provides `SessionErrorMessage.layer` and `RegisterCommandMiddleware.layer`, of its own
  level.

## A controller registers its own commands

- **Problem:** `routes.ts` listed every command with its controller and presenter, so the presentation level had to hold
  every controller's and presenter's needs in one place.
- **Decision:** a controller registers its commands in its `make`, with `RegisterCommandMiddleware`'s `registerCommand`
  and its error message's function, so its layer is all its commands need, and it yields its error message itself.
- **Solution:** each controller's `make` registers its commands, and `extension.ts` merges the controllers' layers into
  `PresentationLayer`. Open Settings only drives VS Code and has no use case, so `AppController` registers it and calls
  `VscodeUtils`'s `openAggregorSettingsInSettingsEditor`. The controller's import rule allows `@middlewares`,
  `@errorMessages` and `@pkg/constants` for registering, and `@pkg/vscode/src/vscode.utils.ts`, whose `VscodeUtils`
  decodes a command's input and opens the settings.
- **Alternatives considered:** `routes.ts` registering every command, as before, which gives every controller the needs
  of all of them.

## Every background job starts in one file

- **Problem:** each job was its own `Layer.effectDiscard` in `app.layer.ts`, with `syncSessionTabsWithTmux` ordered
  before them by its place in a `Layer.provideMerge` chain, so the jobs and their order were spread through the layer
  graph.
- **Decision:** a single place to manage the background, to have the overview from there: one file starts every job an
  application service runs for the window's life, in the order they need. The user's call.
- **Solution:** the `make` of `BackgroundJobs` (`infrastructure/di/backgroundJobs.layer.ts`) yields the services and
  starts the jobs: `sessionService.syncSessionTabsWithTmux` first, then the rest together with `Effect.all`.
  `BackgroundJobs.layer` is merged into `ApplicationLayer`, so the jobs sit at `Application > BackgroundJobs.make`. A
  watcher an implementation or a view runs still starts in its own `make`. `decisions/backgroundJobs.md` lists every
  job.
- **Alternatives considered:** a layer per job in `app.layer.ts`, as before.
