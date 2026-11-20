# Tracing

Span names, the trace log, and the skill that reads it.

## A span's name is its class and its const, written in the source

- **Decision:** an `Effect.fn` is named `<Owner>.<const>`, its class and then its const, and a class's `make` is
  `<Owner>.make`. The name is written in the source, so the trace log prints it as it is, one search for a trace line
  finds the code behind it, and nothing is added while the extension runs. The user's call, after the two forms were
  measured side by side. Every file with a role is its own owner, named by its file: a helper is a unit with its own
  name, so `terminal.utils.ts` is `TerminalUtils` and prints its own name (`RepositoryUtils.encodeStoredColumns`,
  `VscodeUtils.decodeVsCodeArgument`). There is no top-level `Effect.fn`, so a span is named in one of two ways only:
  `<Owner>.make`, or `<Owner>.<const>`.
- **Solution:** `aggregor/span-name` takes the owner from the class an `Effect.fn` is written in, `pnpm lint:fix` writes
  the name, and the rule also checks that a unit's class is named after its file. A unit's layer is
  `Layer.effect(this, this.make())`, as Effect's docs write it, and a call into a unit is a plain call. The name is part
  of the function, so work handed to another unit keeps it: a command handler's spans stay its controller's although
  `RegisterCommandMiddleware` runs it. Measured in a headless VS Code against the build where `ownSpans` supplied the
  owner, on the 41 actions the Sessions view can send, four launches of each build taking turns, every launch from the
  same data:
  - Every span of our own prints as before:
    `aggregorApp.renameSession > SessionController.renameChosenSession > SessionService.renameSession > BaseService.updateEntity > BaseRepository.updateRow > RepositoryUtils.encodeStoredColumns`,
    and a failed command's message is still shown by the middleware:
    `aggregorApp.openSessionPullRequest > RegisterCommandMiddleware.showCommandError > PullRequestErrorMessage.getPullRequestCommandErrorMessage`.
    All 41 actions run the same chain of functions, span for span.
  - No action is slower or faster: for all 41, the two builds' launches overlap or their medians are within 15% and 1
    ms.
  - An action allocates 8% to 15% less while it runs, since no wrapper copies the span's annotations on every call into
    a unit: Rename Session 2,719 KB to 2,318 KB, redrawing the view 24,796 KB to 22,657 KB. The heap after startup is
    48.0 MB against 47.8 MB, and activation is the same within what one launch varies (medians of 102 ms and 105 ms).
  - Startup nests under `Domain`, `Infrastructure` (`Infrastructure > Database.make`), `Application` (the jobs under
    `Application > BackgroundJobs.make`) and `Presentation`, as before.

  Its limits: a library's span has no unit in its name. The SQL client's queries print as `sqlite`, and its migrator's
  steps as `migrate`, `upgradeIfNeeded`, `BEGIN`, `SAVEPOINT`, `RELEASE SAVEPOINT` and `COMMIT`, where `ownSpans` had
  printed the unit they ran in (`BaseRepository.sqlite`, `DatabaseUtils.migrate`); the span above one in the line names
  the unit that ran it. That is 4 names in the replayed actions and 8 more while starting, 32 of the 452 distinct span
  paths a startup prints. Every name repeats its class, 739 names in 91 files, and renaming a file or a class rewrites
  its names, which `pnpm lint:fix` does.

- **Alternatives considered:** simple names with the owner supplied at the unit's boundary, the decision before this
  one: `ownSpans` (`@pkg/trace`) wrapped a unit's `make` in a proxy, marked every span made inside the unit and during a
  call into it with an attribute, and the trace log printed the attribute in front of a name without a dot. It kept the
  names in the source short. It cost the allocations measured above on every call into a unit; special handling for an
  effect, a stream or a callback handed to a unit, for a stream handed back as a result, and for a tagged error or an
  exit passed as a value; a frame at `ownSpans` where a failure's stack should show the calling line; and one more
  helper package. A build step that writes the owner into each name while bundling, which gives the same trace and keeps
  the source short, turned down for a plugin and a parser of its own, tests that would see bare names, and source map
  columns that shift on every renamed line. An owner stated once per unit through a naming helper; a span of its own for
  every call into a unit, which adds a line per call. A span on a unit's layer alone was tried and gives a command's
  lines no owner, because a call hangs under its caller, not under the layer. A top-level `Effect.fn` named
  `<Owner>.<const>`, which went with the last top-level function. A helper file owned by the one owner in its folder
  (`tmuxServer.utils.ts`'s spans as `TmuxInfraService.…`), which went once each helper became a unit of its own. Before
  that, a layer prefix such as `TerminalService.openSessionTerminal`.

## Trace logging is a setting, and a trace carries each error's fields

- **Problem:** the user's log held five warnings and no spans: the installed extension writes span lines at trace level,
  which the output channel hides unless the user finds **Developer: Set Log Level...**, and a failure line named only
  the error's tag, so the cause had to be inferred.
- **Decision:** `aggregorApp.traceLogging` (off by default) writes every line the channel's level would hide again at
  Info, led by its level (`[info] [trace] …`), and follows the setting live; the channel's level still works alone. A
  span line ends with each failure's fields, its cause included
  (`failed: SettingsFileNotSavedError settingsFilePath=…`), and with what the span was annotated with; a logged cause
  leads with the same fields before its stack. `showOnlyProjectFolder` annotates the project and the folders the
  extension host sees, and `saveWorkspaceFileFolders` the file's folders before and after. A failure a caller handles
  stays visible on the span that failed, so the catches that return `Effect.void` stay; the five `Effect.ignore` calls
  that logged nothing now log at Debug or Warn. The headless test window takes `AGGREGOR_VERIFY_LOG_LEVEL` for the
  channel's level. A user can turn on the full trace from Settings and reproduce, and a trace says what failed and with
  which values, so the cause is read, not guessed.
- **Solution:** with the setting on, a switch writes several hundred lines; Effect's SQL spans add their query text.
- **Alternatives considered:** writing spans at Info always, which fills the log of every user; a trace file of
  Aggregor's own in `~/.aggregor`, a second log to rotate; replacing each handled `Effect.void` with a log line, which
  the failed span already records.

## The trace skill reads a trace and files its issue

- **Problem:** finding a cause meant knowing where VS Code keeps each window's log, how to read span lines, and which of
  VS Code's own logs and Aggregor's files to compare them with.
- **Decision:** `.claude/skills/trace` finds the window's `Aggregor App.log`, asks for trace logging and a repro when it
  holds no spans, reads the first failure from the span lines, checks VS Code's `renderer.log`, `exthost.log` and other
  extensions' logs and Aggregor's stored files, and files the issue through the issue skill, with times in UTC and other
  projects' names left out. The steps that found this bug become repeatable, and the issue arrives with its evidence.
- **Alternatives considered:** shipping the skill inside the extension, for any user's agent, before 0.1.0 has users.
