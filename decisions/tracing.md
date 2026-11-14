# Tracing

Span names, the trace log, and the skill that reads it.

## Span names are `<owner>.<const>`

- **Decision:** the owner comes from the file name; `pnpm lint:fix` corrects the names. One search for a trace line
  finds the code behind it.
- **Alternatives considered:** a layer prefix such as `TerminalService.openSessionTerminal`.

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
