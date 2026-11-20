# Tracing

Span names, the trace log, and the skill that reads it.

## A unit's spans take simple names, and the trace log prints the unit in front

- **Decision:** an `Effect.fn` inside a `make` is named by its const alone, and a class's `make` is `make`; the owner is
  supplied once, at the unit's boundary, and the trace log still prints it, so one search for a trace line finds the
  code behind it. The user's call. Every file with a role is its own owner, named by its file: a helper is a unit with
  its own mark, so `terminal.utils.ts` is `TerminalUtils` and prints its own name
  (`RepositoryUtils.encodeStoredColumns`, `VscodeUtils.decodeVsCodeArgument`). There is no top-level `Effect.fn`, so a
  span is named in one of two ways only: `make`, or its const's name.
- **Solution:** `ownSpans` (`packages/trace/src/ownSpans.utils.ts`, `@pkg/trace`) wraps a unit's `make` and marks every
  span made inside the unit, and every span made during a call into it, with an attribute whose key is
  `TRACE_LOGGING.SPAN_OWNER_ATTRIBUTE`; it marks effects, streams, what a member function returns, and a stream an
  effect hands back as its result, which another unit runs. An effect, a stream or a callback a caller hands a member as
  an argument is the caller's work, so while the unit runs it, it keeps the mark the caller had when the call started; a
  tagged error or an exit passed as an argument is a value, not work, and is left as it is. The trace log prints a
  marked span whose name has no dot as `<owner>.<name>` and leaves the attribute out, so a line reads as before:
  `aggregorApp.… > CommitMessageController.generateCommitMessageForSourceControl > CommitMessageService.generateCommitMessage`.
  `aggregor/span-name` checks both naming modes and the name passed to `ownSpans`, and `pnpm lint:fix` corrects them.
  Measured in a headless VS Code:
  - `CommitMessageService.writeCommitMessage` prints under its own name although `VscodeUtils.runWithProgressIndicator`
    runs it, and a command handler's spans stay its controller's although `RegisterCommandMiddleware` runs it:
    `aggregorApp.renameSession > SessionController.renameChosenSession > SessionService.renameSession > BaseService.updateEntity > BaseRepository.updateRow > RepositoryUtils.encodeStoredColumns`.
  - A failed command's message is shown by the middleware:
    `aggregorApp.generateCommitMessage > RegisterCommandMiddleware.showCommandError > CommitMessageErrorMessage.getCommitMessageCommandErrorMessage`.
  - Startup nests under `Domain`, `Infrastructure` (`Infrastructure > Database.make`), `Application` (the jobs under
    `Application > BackgroundJobs.make`) and `Presentation`.

  Its limits: a library's span with an undotted name takes the unit it ran in, as `BaseRepository.sqlite` does; and in a
  failure's stack the frame for a call into a unit points at `ownSpans`, not at the calling line.

- **Alternatives considered:** the owner written into every name by `pnpm lint:fix`, the previous rule, and the fallback
  if the simple names disappoint; an owner stated once per unit through a naming helper; a span of its own for every
  call into a unit, which adds a line per call. A span on a unit's layer alone was tried and gives a command's lines no
  owner, because a call hangs under its caller, not under the layer. Work handed to a unit carrying the running unit's
  name, which printed `writeCommitMessage` as `ProgressInfraService.writeCommitMessage`, until `ownSpans` kept the
  caller's mark on what it hands over. A top-level `Effect.fn` named `<Owner>.<const>`, which went with the last
  top-level function. A helper file owned by the one owner in its folder (`tmuxServer.utils.ts`'s spans as
  `TmuxInfraService.…`), which went once each helper became a unit with its own mark. Before that, a layer prefix such
  as `TerminalService.openSessionTerminal`.

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
