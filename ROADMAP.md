# Roadmap

Each item is one small PR, stacked on the previous one. Releases wait for the end of a milestone.

[decisions/](decisions/README.md) holds why each feature works as it does, by feature: the problem, the decision, the
solution and what was turned down.

## M1: local Claude sessions

- [x] Sessions sidebar: start Claude in an editor tab, list and focus sessions
- [x] Persist and resume: sessions survive reloads; clicking a closed one runs `claude --resume`
- [x] Cleanup before the first release: remove dead ACP, webview and React code, align `@types/vscode` with `engines`
- [x] Live status: running, needs input, idle and exited (from Claude Code hooks then, from OSC 7501 now)

## M2: alerts, multi-project, more agents

- [x] Needs-input alerts: activity-bar badge and a notification for background sessions
- [x] tmux persistence: closing a tab detaches instead of killing the agent; clicking reattaches
- [x] Projects: an extension-owned project list, tree grouped as project > session
- [x] Agents from settings: Claude Code, Codex, Antigravity, OpenCode and GitHub Copilot built in, any other CLI one
      settings entry, and a picker on New Session

## M3: worktrees and review

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
- [ ] Processes in a dropdown under each session's row: its agent's tasks, and what its agent's terminal and its
      folder's shell started; each process's CPU and memory later (#204)
  - [x] `aggregor-pty` records the agent's tasks (Claude Code's sub-agents and background shells), and a working task
        keeps the row working
  - [x] The dropdown, with the tasks
  - [x] The agent terminal's processes, read only while a dropdown is open
  - [x] The folder shell's processes, under every session that shares the shell

- [ ] Review comments: comment on code and send the comments to a session's agent as one prompt
  - [x] Comment on lines in an editor or a diff, and Send Comments to Session
  - [ ] The pending comments' count and Send on the session's row
  - [ ] Comment on the agent's last reply

## M4: tray

- [ ] A tray icon that lists the sessions with their status and pull requests, alerts, and opens a session in VS Code or
      in a plain terminal, also while VS Code is closed; how the backend runs without VS Code is decided when the
      milestone starts, within `DDD.md`'s layers

## M5: SSH

- [ ] One command path for local and remote targets
- [ ] SSH hosts in the sidebar, sessions running in tmux on the host
- [ ] Live status for remote sessions
- [ ] Remote changed files and "Open in Remote Window"

## M6: bundled tmux

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

## If the users asked

Each is an `enhancement` issue, built when users ask for it:

- [ ] Accept (stage), reject (restore) and review all changes (#139)
- [ ] A desktop notification's click lands on the right window when several VS Code windows are open (#101)
- [ ] Sub agents view in the sidebar (#140)
- [ ] A terminal client, light like neovim, for working without VS Code (#141)
- [ ] Show a project in the window without opening a session (#136)
- [ ] A session that belongs to no project, working in the home folder (#138)

## Later

Read-only diffs for SSH sessions in the local window, per-turn checkpoints, screen-based status for agents without OSC
7501, cloud hosts through SSH config, and VS Code's agent sessions API if it becomes stable.
