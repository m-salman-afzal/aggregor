# aggregor

Run coding agents (Claude Code, Codex, Antigravity, OpenCode, GitHub Copilot, or any CLI you add) in their own terminal
UIs, managed from a VS Code sidebar. The idea behind T3 Code, Conductor and Orca, built on what VS Code already has:
terminals, tree views, Source Control and diffs.

## What works today

- **Sessions sidebar.** The Sessions activity-bar view lists the window's projects, each with its sessions, and starts
  an agent in an editor-tab terminal. Clicking a session focuses its tab; switching tabs selects the session. Drag a
  session onto another of its project's sessions, or an added project onto another, to put it in that place, or use Move
  Up and Move Down in the row's … menu.
- **Projects.** The window's workspace folders are always listed; Add Project lists any other folder, and in a window
  showing no project it also shows the first one. Added projects are one list, kept for every window: Aggregor is meant
  to run in one window. A project row's + starts a session in it, the view's + asks which project to use, and an added
  project's … menu removes it.
- **One project in view.** Like VS Code's Agents window, the workspace follows the session in front of you: its project
  is the only folder Explorer, search, file watching and Source Control see. Opening a file keeps the project. The first
  switch opens Aggregor's own workspace, `~/.aggregor/anchor/Aggregor.code-workspace`, in the window: a hidden, empty
  anchor folder the extension owns at folder 0 and the project at folder 1, so later switches never touch folder 0,
  which would restart every extension. That first switch reloads the window once, without asking anything: its agents
  keep running, it reopens the session you switched to, and the folders that leave become added projects. The window is
  then named Aggregor and never asks to be saved.
- **Agents.** New Session asks which agent to start, among those whose command is on `PATH`, with your default first;
  each one's **Set as Default** button changes the default, and `aggregorApp.skipAgentPicker` starts the default without
  asking. Claude Code, Codex, Antigravity, OpenCode and GitHub Copilot are built in. `aggregorApp.agents` in your user
  settings adds a CLI, changes a built-in's name, command, arguments, environment variables (`env`) or icon, or hides
  one with `null`; the gear in the Sessions title bar opens Aggregor's settings. A session's tab shows the same name as
  its row, and the session in front stays selected in the view.
- **Terminals.** The Terminal panel's + opens in the shown project without asking. Its project button opens a shell in
  any of the window's projects, shown or not.
- **Persistent sessions.** Every agent runs in tmux (3.2 or newer), so it keeps working when you close its tab, reload
  the window or quit VS Code; those close the tab, and clicking the session attaches a new one. An agent that has
  stopped, as after a reboot, shows exited, and clicking it resumes the conversation. Every window that lists a project
  shows its sessions. The row's … menu removes a session and stops its agent.
- **Session titles.** Each tab and row shows the title the agent gives its terminal, as it changes (for Claude, its own
  title for the conversation or the one set with `/rename`); a closed session keeps the last one. Rename in the row's …
  menu gives a session your own name in the row and the tab; an empty name hands both back to the agent.
- **Live status.** Each row ends with a status badge: a blue spinner while the agent works, a yellow dot when it waits
  on you (the row says for what: permission, a question or a sign-in, and the tooltip shows the agent's message) and a
  red cross on an error. A turn that finishes while you are looking elsewhere leaves a green check until you open that
  session's tab; a session you have seen shows no badge, and a grey hollow dot means it has exited. Reported progress
  shows next to the name. The status comes from the agent's own OSC 7501 reports, read by `aggregor-pty`, which runs
  every session's agent; the Linux and macOS builds carry it, and on Windows sessions run in WSL.
- **Alerts.** A session out of view notifies once it has held a new state for 3 seconds: waiting for you, finished, an
  error or its agent exiting by default, picked with `aggregorApp.notifyOn`. The focused window shows it with an
  **Open** button; when VS Code isn't focused it is a system notification instead, with the agent's logo. Clicking it
  brings VS Code forward, even from another workspace, and opens the session when the window that comes forward is the
  one that sent it (`notify-send` on Linux; a PowerShell toast from WSL and `osascript` on macOS, both untested). The
  Sessions icon's badge counts the sessions waiting on you, and hovering it lists them.
- **AI commit messages.** A Source Control button writes the commit message for the staged diff.

## Roadmap

Each item is one small PR, stacked on the previous one. Releases wait for the end of a milestone.

[phase2.md](phase2.md) plans the next stack step by step: SQLite storage, status from OSC 7501, agents from settings,
tmux and alerts.

### M1: local Claude sessions

- [x] Sessions sidebar: start Claude in an editor tab, list and focus sessions
- [x] Persist and resume: sessions survive reloads; clicking a closed one runs `claude --resume`
- [x] Cleanup before the first release: remove dead ACP, webview and React code, align `@types/vscode` with `engines`
- [x] Live status: running, needs input, idle and exited (from Claude Code hooks then, from OSC 7501 now)

### M2: alerts, multi-project, more agents

- [x] Needs-input alerts: activity-bar badge and a notification for background sessions
- [x] tmux persistence: closing a tab detaches instead of killing the agent; clicking reattaches
- [x] Projects: an extension-owned project list, tree grouped as project > session
- [x] Agents from settings: Claude Code, Codex, Antigravity, OpenCode and GitHub Copilot built in, any other CLI one
      settings entry, and a picker on New Session

### M3: worktrees and review

- [ ] Worktree mode: start a session in the project root or in a new git worktree
- [ ] Changed files under each session, opening git's diff with per-hunk staging
- [ ] Archive/Done sessions: remove the worktree, keep unmerged branches
- [ ] Bookmarks
- [ ] Create/Link a pull request from a session

### M4: SSH

- [ ] One command path for local and remote targets
- [ ] SSH hosts in the sidebar, sessions running in tmux on the host
- [ ] Live status for remote sessions
- [ ] Remote changed files and "Open in Remote Window"

### M5: bundled tmux

- [ ] Bundled tmux: each platform VSIX carries its own tmux, so sessions need nothing installed
  - Build one pinned tmux release from source in `release.yaml`, next to `aggregor-pty`: fully static for Linux x64 and
    arm64 (musl, with libevent and ncurses), and for macOS x64 and arm64 with libevent and ncurses linked in and only
    the system library dynamic, as every macOS binary is. A WSL window installs the Linux VSIX, so it gets one too.
  - A Linux or macOS VSIX always runs its own `bin/tmux`. A local build without it keeps `tmux` from `PATH`, with the
    version check and the Install tmux button.
  - Ship the `xterm-256color` and `tmux-256color` terminfo entries and point tmux at them (`TERMINFO_DIRS`): Linux
    distributions keep them in different places, and macOS has no `tmux-256color`.
  - `pnpm --filter=aggregor-app build:tmux` builds it for this machine into `apps/extension/bin`, like `build:pty`; it
    needs a C compiler.
  - The VSIX carries the licence notices of tmux (ISC), libevent (BSD-3) and ncurses (MIT-style).
  - Reverses step 5's "no bundled tmux" in `phase2.md`, whose objection was that macOS has no fully static build.
  - Risk: an update that bumps tmux while an older server still runs on the socket; check that the client-server
    protocol version is unchanged before each bump.

### If the users asked

- [ ] Accept (stage), reject (restore) and review all changes
- [ ] A desktop notification's click lands on the right window when several VS Code windows are open
  - Problem: GNOME brings forward the VS Code window used most recently, not the one that sent the notification. Only
    GNOME may bring a window forward without a click in it, and it can't target one of VS Code's windows: it hands a
    token to the program that sent the notification, and VS Code has no way to take one from outside. A click inside VS
    Code does let it switch to another of its windows (checked with `code ‹file›` from another window's terminal).
  - Proposal: a `sessionAlerts` table the windows share, one row per alert with its session, the state change, the link
    of the window that showed it and when its notification closed. One window claims each alert: a focused window at
    once, the one holding the session's tab after 300 ms, any other after 600 ms, so several windows no longer notify
    twice. The claiming window records when its notification closed. The window that comes into focus within 1.5 seconds
    of that opens the session if it claimed the alert; otherwise it shows "‹session› finished · Open", whose click opens
    the claiming window's link, which brings that window forward with the session. Costs a schema change; the focus
    timing can misfire as it does now.

- [ ] sub agents view in the sidebar (need to research on how is that possible for each kind of agent)

### Later

Read-only diffs for SSH sessions in the local window, per-turn checkpoints, screen-based status for agents without OSC
7501, cloud hosts through SSH config, and VS Code's agent sessions API if it becomes stable.

## Development

See [AGENTS.md](AGENTS.md) for the commands. Press F5 in VS Code to run the extension; it keeps its data in
`~/.aggregorDev`, so the installed extension's `~/.aggregor` stays untouched. `AGGREGOR_HOME` moves the whole folder and
`AGGREGOR_DATABASE_FILE` only the database, each an absolute path.
