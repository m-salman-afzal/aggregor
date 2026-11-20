# Status display

How a session's status shows on its row.

## Rows show the status on the session's row

- **Problem:** status has to come from every agent, including a turn the user interrupts.
- **Decision:** `aggregor-pty` runs every session's agent and writes its OSC 7501 reports onto the session's row. A row
  whose agent tmux no longer runs shows exited, so an agent that died without writing `exited`, as at a reboot, never
  looks alive (a row with no tab in this window counted as exited before); otherwise `blocked`, `error`, `working` and
  `exited` show as themselves, `unknown` and `idle` show idle, and `done` shows finished until the user has seen it,
  then idle. Seen is stored: the extension writes `viewedAt` on a session as it comes into view and as it leaves, and
  `done` counts as unseen while `statusChangedAt` is after `viewedAt` and the session is out of view
  (`getSessionStatus`). `error` shows as error.
  - Unread was first an in-memory set per window (the first build), lost on every extension restart, such as the first
    project switch. Writing `idle` over `done` instead would make the extension a second writer of `aggregor-pty`'s
    column, and `aggregor-pty` would have to stop rewriting a state that didn't change.
  - An agent that ends a turn with `idle` instead of `done` (OpenCode 2.2.5) shows no finished mark.

  Every agent that speaks OSC 7501 reports the same states, an interrupt included, and an agent that never reports
  (Copilot) sits at idle instead of looking stuck. Stored, a finished turn survives an extension restart and shows the
  same in every window, and each column keeps one writer.

- **Alternatives considered:** Claude Code hooks passed with `--settings`, writing a word per session to a status file
  the extension watched: Claude only, and no hook runs for an interrupted turn. On top of them, the interrupt settle: a
  running session went idle once its terminal title had shown Claude's idle mark for 3 seconds, which a renamed tab
  broke.

## Each status has a row badge

- **Problem:** six row states need to be told apart at a glance.
- **Decision:** the row's icon stays the agent's logo, and its badge, which also tints the label, is working's blue
  spinner, blocked's yellow `●`, done's green `✓`, error's red `✕` and exited's grey `○`; idle has none. A blocked row's
  label names its kind (needs permission, has a question, needs sign-in), the tooltip carries the agent's message, and
  progress shows as `42%` after the name. The agent's logo tells sessions apart once there are five agents, and text
  badges are what the stable API draws.
- **Alternatives considered:** codicons (`bell-dot`, `check`, `error`, `circle-outline`, `debug-stop`, as planned): a
  badge takes only up to two characters of text, codicon badges are a proposed API, and as the row's icon they would
  replace the agent's logo.

## A session cut off by a restart shows as interrupted

- **Problem:** after the computer restarts every agent has stopped and every session shows exited, so the user can't
  tell which ones were at work, the ones to resume, from those long done. Their old status is no help: a running turn
  was cut off, so it should not come back.
- **Decision:** a session whose agent was running when it was cut off shows interrupted, with a yellow-orange restart
  icon and "stopped by a restart · click to resume" in its tooltip, until its agent runs again; clicking it resumes it
  as clicking an exited session does. It is cut off when a window starts with no agent running at all, since tmux's
  server went away with them, as it does when the computer restarts, the user logs out or tmux is killed. An agent that
  stops while VS Code runs, by itself or by Stop Agent, loses the mark.
- **Solution:** a new `sessions.runState` column (`SessionRunStateValueObject`: `running`, `interrupted`) and a new
  `interrupted` value of `SessionStatusValueObject`, which `getSessionStatus` gives a stopped agent marked interrupted.
  `startRunStateSync` in the session service marks each session `running` as tmux lists its agent, clears the mark of
  one tmux stopped listing once the list has held still for 10 seconds, and, as the window starts with tmux listing no
  agent, turns every `running` mark into `interrupted`. The wait keeps the mark through a shutdown, which ends VS Code
  within it. aggregor-pty writes `exited` however its agent ends, a shutdown's SIGTERM included, so the mark can't come
  from the status columns. Explainer: [Interrupted Sessions](https://claude.ai/artifact/UebQZoxrmT9BvAcF5H4ShF), made
  2026-11-20, a 30-second film of the marks through agents starting, a stop while VS Code runs, a restart, the next
  window's start and a click that resumes one.
- **Alternatives considered:** the status columns alone, which a clean shutdown sets to exited like any other end;
  aggregor-pty recording that a signal ended its agent, which Stop Agent's hangup also sends; the machine's boot id, a
  platform call per system that still needs to know what ran at the shutdown; restoring each session's last status,
  which shows a turn running that a restart ended; a Resume Interrupted button for all of them, left until marking them
  is not enough.
