# Titles

The name a session shows.

## Session titles come from what the agent reports

- **Decision:** `aggregor-pty` stores the title from the agent's 7501 report and its OSC 0/2 title on the row, and
  `getSessionTitle` takes the first that holds a title: status marks (symbols, spaces and control characters) trimmed at
  both ends, the agent's name, its command or the project folder dropped where joined by `-`, `|` or `:` at either end,
  and not empty, one of those names alone, only an id (a UUID, maybe with a prefix such as `ses_`), or a start time
  (OpenCode's `New session - 2026-11-09T09:26:37.754Z`). The title becomes the session's `name`, so the row keeps it
  while the agent is gone or resuming; only that save is traced, since the check runs on every write to a session.
  Rename stores a `customName`, which wins in the row and the tab. One rule covers every agent's title, and an agent
  adds no title code.
- **Solution:** a title's way from the agent to the row is in the explainer
  [Aggregor Titles and Branches](https://claude.ai/artifact/25cQsgG1j3EHJRmCAW2qpZ): the agent's OSC 2 bytes pass
  through `aggregor-pty`'s pseudo-terminal (portable-pty) to tmux, `aggregor-pty` writes the title to the session's row
  at most twice a second, the extension sees `data_version` move, and the title sync saves the name, which redraws the
  row.
- **Alternatives considered:** read Claude's transcript (the earlier build; Orca and cmux read OSC titles and the
  transcript); generate a title with an LLM, as T3 Code and Conductor do; read `Terminal.name` every second, since no
  change event exists.
