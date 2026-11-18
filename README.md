# aggregor

Run coding agents (Claude Code, Codex, Antigravity, OpenCode, GitHub Copilot, or any CLI you add) in their own terminal
UIs, managed from a VS Code sidebar. The idea behind T3 Code, Conductor and Orca, built on what VS Code already has:
terminals, tree views, Source Control and diffs.

## What works today

- **Sessions sidebar.** The Sessions activity-bar view lists the window's projects, each with its sessions, and starts
  an agent in an editor-tab terminal. The Archive, the sessions you are done with, is a drawer docked at the bottom that
  opens upward. Each project lists its sessions newest first, its 10 newest at a time, with Show more for the next 10.
  `aggregorApp.fontSize` sets the view's text size, and its spacing scales with it; `aggregorApp.accentColor` its accent
  (`neutral`, `theme`, `palette` or a `#rrggbb` colour). Clicking a session focuses its tab; switching tabs marks the
  session. Every row shows its buttons and a … menu on hover (a session's Archive is a button of its own), and
  right-clicking it opens the same menu; Move Up and Move Down there put a session or an added project in another place.
  The Sessions title holds New Session…, Add Project and Open Settings. What a command asks (a confirmation, a name,
  which project or agent) opens as a dialog in the view, over its blurred lists, rather than at the window's top.
  Archiving never asks: the agent runs on in the Archive, where Stop Agent stops it; a stop asks only when it cuts a
  turn short.
- **Projects.** The window's workspace folders are always listed; Add Project lists any other folder, and in a window
  showing no project it also shows the first one. Added projects are one list, kept for every window: Aggregor is meant
  to run in one window. A project row's + starts a session in it, the Sessions title's + asks which project to use, its
  terminal button opens the terminal on the project's shell, and its … menu edits its settings (Project Settings…: where
  its worktrees go, the files copied into them, a setup script, and whether new sessions start in a worktree) and, for
  an added project, removes it. Its Import Sessions… lists the conversations Claude Code, Codex, OpenCode and GitHub
  Copilot had in the project's folder that aren't sessions yet, newest first under each agent; the ones you tick become
  sessions, and clicking one resumes that conversation. Everything runs from the view; the Command Palette lists no
  Aggregor command.
- **One project in view.** Like VS Code's Agents window, the workspace follows the session in front of you: its project
  is the only folder Explorer, search, file watching and Source Control see. Opening a file keeps the project. The first
  switch opens Aggregor's own workspace, `~/.aggregor/anchor/Aggregor.code-workspace`, in the window: a hidden, empty
  anchor folder the extension owns at folder 0 and the project at folder 1, so later switches never touch folder 0,
  which would restart every extension. That first switch reloads the window once, without asking anything: its agents
  keep running, it reopens the session you switched to, and the folders that leave become added projects. The window is
  then named Aggregor and never asks to be saved. Later switches rewrite the file's folders, and the project's settings
  with them, in one write; in the rare case VS Code confirms none of that, the window reloads once to catch up.
- **Worktrees.** In a git project, New Session can start a session in its project's root, in a new git worktree of its
  own (from the current commit, on an `aggregor/<session>` branch, with the project's `.env*` or `.worktreeinclude`
  files copied in and its setup script run first), or in a worktree that already exists. While that session is in front,
  the window shows its worktree, so Source Control shows its changes. Change Working Tree in a session's menu moves it
  to another of those, and Unlink Worktree back to the root, resuming its running agent there. The branch takes the
  session's first title (`aggregor/login-fix`) unless it was pushed, shows on the session's row, and Rename Branch in
  its menu renames it. Remove deletes the session's worktree and keeps its branch; a worktree with changes is kept until
  you commit or discard them. When a project has worktrees or `aggregor/*` branches left over, a red dot shows on its
  row and its broom button lists them, with merged branches ticked, to delete the ones you pick. A worktree session's
  row counts the files and lines its branch changed since the base branch, its uncommitted edits and new files included.
  VS Code asks to trust each new worktree until you trust the folder they go in; New Session's hint copies its path and
  opens Manage Workspace Trust.
- **Agents.** New Session asks which agent to start, among those whose command is on `PATH`, with your default first;
  each one's **Set as Default** button changes the default, and `aggregorApp.skipAgentPicker` starts the default without
  asking. Claude Code, Codex, Antigravity, OpenCode and GitHub Copilot are built in. `aggregorApp.agents` in your user
  settings adds a CLI, changes a built-in's name, command, arguments, environment variables (`env`) or icon, or hides
  one with `null`; the gear on the Sessions title opens Aggregor's settings. A session's tab shows the same name as its
  row, whose second line shows the agent's icon, and the session in front stays marked in the view.
- **Terminals.** Each project, and each worktree a session works in, has one shell of its own, running in tmux like the
  agents, so a dev server started there keeps running when you reload the window or quit VS Code. The window has one
  terminal for them, named Aggregor, in the Terminal panel: the terminal button on a project's or a session's row shows
  it on that folder's shell, and a line at its bottom names the folder. When you switch session, it moves to that
  session's folder's shell without opening a hidden panel. The panel's trash icon ends the shell on screen, and so does
  `exit`; removing a worktree or a project ends theirs. Its scrollback is tmux's, as in a session's tab: the wheel
  scrolls it, with no scrollbar and no shell integration. tmux stays out of sight there and in session tabs: no menus,
  splits or floating panes, and the shell doesn't see it. The Terminal panel's + still opens a plain VS Code terminal in
  the shown project, without asking.
- **Persistent sessions.** Every agent runs in tmux (3.2 or newer), so it keeps working when you close its tab, reload
  the window or quit VS Code; those close the tab, and clicking the session attaches a new one. With
  `aggregorApp.openSessionIn` set to `sharedTab`, one tab shows the session opened last: a running session switches into
  it in place, with no tab opening or closing. `aggregorApp.pinSessionTabs` pins a session's tab as it opens. An agent
  that has stopped shows exited, and clicking it resumes the conversation; one that was running when the computer
  restarted shows interrupted, with a restart icon, until it is resumed. Every window that lists a project shows its
  sessions. The row's … menu removes a session and stops its agent. When memory runs out on Linux, agents are killed
  before VS Code; with systemd, each agent runs in a cgroup of its own, so only that session goes, and
  `aggregorApp.sessionMemoryLimit` caps each one.
- **Session titles.** Each tab and row shows the title the agent gives its terminal, as it changes (for Claude, its own
  title for the conversation or the one set with `/rename`); a closed session keeps the last one. Rename in the row's …
  menu gives a session your own name in the row and the tab; an empty name hands both back to the agent.
- **Live status.** Each row starts with a status icon: a blue spinner while the agent works, a yellow alert when it
  waits on you (the tooltip says for what: permission, a question or a sign-in; the agent's message shows on the row's
  second line) and a red cross on an error. A turn that finishes while you are looking elsewhere leaves a green check
  until you open that session's tab, and a grey dashed circle means it has exited. Reported progress shows on the second
  line. The status comes from the agent's own OSC 7501 reports, read by `aggregor-pty`, which runs every session's
  agent; the Linux and macOS builds carry it, and on Windows sessions run in WSL.
- **Alerts.** A session out of view notifies once it has held a new state for 3 seconds: waiting for you, finished or an
  error by default, picked with `aggregorApp.notifyOn`, which can add its agent exiting. The focused window shows it
  with an **Open** button; when VS Code isn't focused it is a system notification instead, with the agent's logo.
  Clicking it brings VS Code forward, even from another workspace, and opens the session when the window that comes
  forward is the one that sent it (`notify-send` on Linux; a PowerShell toast from WSL and `osascript` on macOS, both
  untested). The Sessions icon's badge counts the sessions waiting on you, and hovering it lists them; the Sessions and
  Archive titles show how many of them each list holds.
- **Pull requests.** A worktree session's row shows its branch's pull request, `#123` coloured by whether it is open, a
  draft, merged or closed, as the GitHub CLI (`gh`) finds it, looked up again when the window regains focus and when the
  session's turn ends. Link Pull Request in a session's menu picks another from the repository's, root sessions
  included, and Unlink Pull Request goes back to the branch's. Clicking it, or Open Pull Request in the row's … menu,
  opens it in the browser, or in the GitHub Pull Requests extension with `aggregorApp.openPullRequestIn` set to
  `vscode`. Signed out of `gh`, a notification offers to run `gh auth login` in a terminal.
- **Setup.** When the window starts without tmux or `gh`, one notification names what is missing, and its Install runs
  one command for the system's package manager, such as `sudo apt-get install -y tmux gh`, in a terminal.
- **AI commit messages.** A Source Control button writes the commit message for the staged diff.
- **Trace logging.** `aggregorApp.traceLogging` writes every step Aggregor runs, with the fields of every error it
  meets, to the **Aggregor App** output channel and its log file, to attach to a bug report.

## Roadmap

Each item is one small PR, stacked on the previous one. Releases wait for the end of a milestone.

[decisions/](decisions/README.md) holds why each feature works as it does, by feature: the problem, the decision, the
solution and what was turned down.

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

- [x] Archive sessions you are done with, in an Archive view under Sessions
- [ ] Sessions sidebar as a webview of our own design: one view with a dropdown per list (Sessions, Archive, later SSH
      and snoozed), rows of up to three lines, menus, drag and drop and keyboard
- [x] Worktree mode: start a session in the project root or in a new git worktree; Remove deletes the worktree, and each
      project's cleanup deletes the leftover worktrees and the branches you pick, merged ones first
- [x] Changed files and lines on each worktree session's row
- [ ] Bookmarks
- [x] A session's pull request on its row, from the GitHub CLI
- [ ] Create a pull request from a session
- [x] Change a session's working tree: the project root, a new worktree or an existing one, restarting its agent there;
      Unlink Worktree moves it back to the root
- [x] Link a pull request to a session, change it or unlink it
- [x] One Install for whatever of tmux and gh is missing, through the system's package manager
- [x] Import a project's earlier Claude Code, Codex, OpenCode and Copilot conversations as sessions
- [x] Folder shells in tmux: one Aggregor terminal a window, on the shell of the project's or the session's folder,
      which outlives the window
- [x] The Aggregor terminal follows the session in view, without opening the Terminal panel
- [ ] Processes on each session's row: what its agent and its folder's shell started, with their memory and CPU

### M4: tray

- [ ] A tray icon that lists the sessions with their status and pull requests, alerts, and opens a session in VS Code or
      in a plain terminal, also while VS Code is closed; how the backend runs without VS Code is decided when the
      milestone starts, within `DDD.md`'s layers

### M5: SSH

- [ ] One command path for local and remote targets
- [ ] SSH hosts in the sidebar, sessions running in tmux on the host
- [ ] Live status for remote sessions
- [ ] Remote changed files and "Open in Remote Window"

### M6: bundled tmux

- [ ] Bundled tmux: each platform VSIX carries its own tmux, so sessions need nothing installed
  - Build one pinned tmux release from source in `release.yaml`, next to `aggregor-pty`: fully static for Linux x64 and
    arm64 (musl, with libevent and ncurses), and for macOS x64 and arm64 with libevent and ncurses linked in and only
    the system library dynamic, as every macOS binary is. A WSL window installs the Linux VSIX, so it gets one too.
  - A Linux or macOS VSIX always runs its own `bin/tmux`. A local build without it keeps `tmux` from `PATH`, with the
    version check and the Install button.
  - Ship the `xterm-256color` and `tmux-256color` terminfo entries and point tmux at them (`TERMINFO_DIRS`): Linux
    distributions keep them in different places, and macOS has no `tmux-256color`.
  - `pnpm --filter=aggregor-app build:tmux` builds it for this machine into `apps/extension/bin`, like `build:pty`; it
    needs a C compiler.
  - The VSIX carries the licence notices of tmux (ISC), libevent (BSD-3) and ncurses (MIT-style).
  - Reverses "no bundled tmux" in `decisions/sessions/terminals.md`, whose objection was that macOS has no fully static
    build.
  - Risk: an update that bumps tmux while an older server still runs on the socket; check that the client-server
    protocol version is unchanged before each bump.

### If the users asked

Each is an `enhancement` issue, built when users ask for it:

- [ ] Accept (stage), reject (restore) and review all changes (#139)
- [ ] A desktop notification's click lands on the right window when several VS Code windows are open (#101)
- [ ] Sub agents view in the sidebar (#140)
- [ ] A terminal client, light like neovim, for working without VS Code (#141)
- [ ] Show a project in the window without opening a session (#136)
- [ ] A session that belongs to no project, working in the home folder (#138)

### Later

Read-only diffs for SSH sessions in the local window, per-turn checkpoints, screen-based status for agents without OSC
7501, cloud hosts through SSH config, and VS Code's agent sessions API if it becomes stable.

## Development

See [AGENTS.md](AGENTS.md) for the commands. Press F5 in VS Code to run the extension; it keeps its data in
`~/.aggregorDev`, so the installed extension's `~/.aggregor` stays untouched. `AGGREGOR_HOME` moves the whole folder and
`AGGREGOR_DATABASE_FILE` only the database, each an absolute path.
