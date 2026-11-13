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
  VS Code from starting. `eval`, `webview-eval`, `webview-hover`, `log` and `screenshot` work inside it.
- Linux only, with `mutter`, `dbus-run-session` and `code` installed (stock Ubuntu GNOME has all three). On another OS,
  say so instead of verifying.

## Commands

From the repo root, as `node .claude/skills/verify-in-vscode/vscode.ts <command>`:

| Command                       | What it does                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `start [workspace]`           | Stops any earlier run, builds the extension, its webview and `aggregor-pty`, launches it and prints the trace log's path. |
| `log`                         | Prints the trace log's path again.                                                                                        |
| `eval '<expression>'`         | Runs JavaScript in the VS Code window and prints the result as JSON. Return plain data, not DOM nodes.                    |
| `webview-eval '<expression>'` | The same in the Sessions view's webview page, with `document` and `window` its own. The view must have been in sight.     |
| `webview-hover <x,y>`         | Turns the webview's hover styles on and moves the mouse to that point of the window, in CSS pixels; then `screenshot`.    |
| `screenshot <png path>`       | Saves a screenshot. Pass an absolute path in your scratchpad, never inside the repo; then read the image.                 |
| `stop`                        | Closes VS Code, the Claude sessions started in its terminals, mutter and the private D-Bus session.                       |

`start` again after every code change: a running VS Code never picks up a new build.

The workspace defaults to `$AGGREGOR_VERIFY_WORKSPACE`, else `~/side/jsTester`. It must be a folder Claude already
trusts, or Claude's trust prompt holds every session before it reports a status. Use a throwaway repo, never one whose
git state matters: Source Control checks can stage files there.

The VS Code profile lives in `~/.cache/aggregor-verify/vscode-data` and the extension's Aggregor folder (database,
`aggregor-pty`'s log, anchor folder) in `~/.cache/aggregor-verify/aggregor` (or `$AGGREGOR_HOME`), never the real
`~/.aggregor` or the F5 build's `~/.aggregorDev`. Both persist between runs, sessions and added projects included.
Delete them to start fresh, or run `start` with `AGGREGOR_DATABASE_FILE` set to an absolute path to try another
database.

## Checking a change

1. **Read the trace log first.** Every command is a root span and every `Effect.fn` a child span (see `AGENTS.md`), so
   `grep` the log for the command ID, a `failed:` outcome, or a `[warning]`/`[error]` line. That alone settles most
   checks.
2. **Drive the window over CDP** for anything the user would see or click. Useful expressions:
   - Open the Aggregor container, whose one pane is the Sessions view, which also loads its webview. Clicking its
     activity-bar item toggles it, so click only when it is not already open; a badge's count can follow the name in its
     label:
     `(() => { const item = [...document.querySelectorAll(".activitybar .action-label")].find((element) => (element.getAttribute("aria-label") || "").startsWith("Aggregor")); if (!item.closest(".action-item").classList.contains("checked")) item.click(); return "open"; })()`
   - The Sessions view is a webview, a page of its own: read and click it with `webview-eval`. It holds two lists,
     Sessions and Archive, each under a header that folds it; the Archive starts folded. Its text, lists, projects and
     sessions with each session's second line: `document.body.innerText`. The row of the session in front is the one
     with `aria-current="true"`; open a session by clicking its row, whose button's text starts with its title:
     `(() => { [...document.querySelectorAll("li button")].find((button) => button.innerText.startsWith("jsTester #1")).click(); return "clicked"; })()`
   - Unfold the Archive, or fold any list or project, by clicking its header:
     `(() => { [...document.querySelectorAll("[data-slot=collapsible-trigger]")].find((button) => button.textContent.startsWith("Archive")).click(); return "toggled"; })()`
   - Open a row's … menu (a session's, a project's or a list's header's), then pick an item; a bare `click()` works on
     both, though the buttons only show on hover. The menu's items are `[data-slot=dropdown-menu-item]`:
     `(() => { const row = [...document.querySelectorAll("li")].find((element) => element.textContent.includes("jsTester #1")); row.querySelector('button[aria-label="More Actions…"]').click(); return "opened"; })()`
     `(() => { [...document.querySelectorAll("[data-slot=dropdown-menu-item]")].find((item) => item.textContent === "Archive").click(); return "picked"; })()`
   - Right-click a row for the same menu: dispatch a `contextmenu` `MouseEvent` (`bubbles`, `button: 2`, `clientX` and
     `clientY` inside the row) on its button, then pick an item as above.
   - The Sessions list's header holds New Session…, Add Project and Open Settings as buttons, by their `aria-label`:
     `(() => { document.querySelector('button[aria-label="New Session…"]').click(); return "clicked"; })()`
   - What a command asks (a question, Rename, the project and agent pickers) is a dialog in the webview, not a quick
     pick: read it with `document.querySelector("[data-slot=dialog-content]")?.innerText`, click a choice's button by
     its text, or Cancel; fill a text prompt and submit it:
     `(() => { const input = document.querySelector("[data-slot=dialog-content] input"); input.value = "New name"; input.form.requestSubmit(); return "submitted"; })()`
   - Hover styles don't show by themselves: the headless window has no pointer, so `(hover: hover)` is false and
     Tailwind's `hover:` classes never apply, while the buttons that show on hover are always shown. `webview-hover x,y`
     turns the hover styles on until the page reloads and moves the mouse to that point of the window; read an element's
     place with `getBoundingClientRect()` in `webview-eval` and add the webview frame's own (`iframe.webview` in
     `eval`), then take a `screenshot`, whose pixels are the window's CSS pixels times its `devicePixelRatio` (about
     1.09). A row's buttons take a bare `click()` either way.
   - Read the notifications:
     `[...document.querySelectorAll(".notification-list-item")].map((element) => element.textContent)`
3. **Check the stored data** when a change touches it: stop VS Code first, then read or seed
   `~/.cache/aggregor-verify/vscode-data/User/globalStorage/state.vscdb` (globalState) or
   `.../User/workspaceStorage/<id>/state.vscdb` (workspaceState) with Python's `sqlite3`. The extension's values sit
   under the key `SalmanAfzal.aggregor-app`.
4. **Stop**, then report what you checked and what you could not.

Never click **Stage All & Generate** or commit in the test window, and never generate a commit message on a repo with
staged changes: it runs the real Claude CLI and can commit.
