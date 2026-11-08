---
name: verify-in-vscode
description:
  Run the aggregor extension in a real but headless VS Code and check that a change works there, by reading its trace
  log and querying or clicking the window over CDP. Use after changing extension behaviour (commands, the Sessions view,
  statuses, Source Control, stored data), or when the user asks to verify, test or try something in VS Code. Linux only.
---

# Verify in VS Code

`vscode.ts` (next to this file) builds the extension and runs it in an isolated VS Code inside a headless Wayland
compositor (mutter) on a private D-Bus session. Nothing appears on the user's screen and nothing reaches their desktop,
so they can keep working.

## Rules

- **Never open a visible VS Code window.** A window that shows up interrupts the user. Only `vscode.ts start` launches
  VS Code; never run `code` yourself.
- **Always stop it when you are done.** Run `vscode.ts stop` as soon as the checks are over, before the final message of
  the turn, even when a check failed. Nothing may outlive the turn that started it.
- Backstops, in case a turn ends early: the repo's hooks (`.claude/settings.json`) run `stop --hook` when a turn ends,
  when the next prompt arrives (a turn the user interrupted skips the turn-end hook) and when the session ends. The
  launch also closes itself once the Claude session that started it is gone, or after 20 minutes. The backstops are for
  accidents; stopping is still your job.
- Run `start` and `stop` with the Bash sandbox disabled: the sandbox swallows the signals that stop processes and keeps
  VS Code from starting. `eval`, `log` and `screenshot` work inside it.
- Linux only, with `mutter`, `dbus-run-session` and `code` installed (stock Ubuntu GNOME has all three). On another OS,
  say so instead of verifying.

## Commands

From the repo root, as `node .claude/skills/verify-in-vscode/vscode.ts <command>`:

| Command                 | What it does                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `start [workspace]`     | Stops any earlier run, builds the extension and `aggregor-pty`, launches it and prints the trace log's path. |
| `log`                   | Prints the trace log's path again.                                                                           |
| `eval '<expression>'`   | Runs JavaScript in the VS Code window and prints the result as JSON. Return plain data, not DOM nodes.       |
| `screenshot <png path>` | Saves a screenshot. Pass an absolute path in your scratchpad, never inside the repo; then read the image.    |
| `stop`                  | Closes VS Code, the Claude sessions started in its terminals, mutter and the private D-Bus session.          |

`start` again after every code change: a running VS Code never picks up a new build.

The workspace defaults to `$AGGREGOR_VERIFY_WORKSPACE`, else `~/side/jsTester`. It must be a folder Claude already
trusts, or Claude's trust prompt blocks every session's hooks and statuses never appear. Use a throwaway repo, never one
whose git state matters: Source Control checks can stage files there.

The VS Code profile lives in `~/.cache/aggregor-verify/vscode-data` and persists between runs, sessions and added
projects included. Delete that folder to start from a fresh profile.

## Checking a change

1. **Read the trace log first.** Every command is a root span and every `Effect.fn` a child span (see `AGENTS.md`), so
   `grep` the log for the command ID, a `failed:` outcome, or a `[warning]`/`[error]` line. That alone settles most
   checks.
2. **Drive the window over CDP** for anything the user would see or click. Useful expressions:
   - Open the Sessions view. Clicking its activity-bar item toggles it, so click only when it is not already open:
     `(() => { const item = [...document.querySelectorAll(".activitybar .action-label")].find((element) => element.getAttribute("aria-label") === "Sessions"); if (!item.closest(".action-item").classList.contains("checked")) item.click(); return "open"; })()`
   - List the rows with their status:
     `[...document.querySelectorAll(".monaco-list-row")].map((row) => row.getAttribute("aria-label")).filter(Boolean)`
   - Click a title or inline button by its label, such as `New Session...` or `New Claude Session`:
     `[...document.querySelectorAll(".action-label")].find((element) => element.getAttribute("aria-label") === "New Session...").click()`
   - Read the notifications:
     `[...document.querySelectorAll(".notification-list-item")].map((element) => element.textContent)`
3. **Check the stored data** when a change touches it: stop VS Code first, then read or seed
   `~/.cache/aggregor-verify/vscode-data/User/globalStorage/state.vscdb` (globalState) or
   `.../User/workspaceStorage/<id>/state.vscdb` (workspaceState) with Python's `sqlite3`. The extension's values sit
   under the key `SalmanAfzal.aggregor-app`.
4. **Stop**, then report what you checked and what you could not.

Never click **Stage All & Generate** or commit in the test window, and never generate a commit message on a repo with
staged changes: it runs the real Claude CLI and can commit.
