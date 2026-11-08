# aggregor

Run coding agents (Claude Code, later Gemini, OpenCode and Codex) in their own terminal UIs, managed from a VS Code
sidebar. The idea behind T3 Code, Conductor and Orca, built on what VS Code already has: terminals, tree views, Source
Control and diffs.

## What works today

- **Sessions sidebar.** The Sessions activity-bar view lists the window's projects, each with its sessions, and starts
  Claude Code in an editor-tab terminal. Clicking a session focuses its tab; switching tabs selects the session.
- **Projects.** The window's workspace folders are always listed; Add Project lists any other folder, and in a window
  showing no project it also shows the first one. Added projects are one list, kept for every window: Aggregor is meant
  to run in one window. A project row's + starts a session in it, the view's + asks which project to use, and an added
  project's … menu removes it.
- **One project in view.** Like VS Code's Agents window, the workspace follows the session in front of you: its project
  is the only folder Explorer, search, file watching and Source Control see. Opening a file keeps the project. The first
  switch replaces folder 0 with a hidden, empty anchor folder the extension owns, so later switches never touch folder
  0, which would restart every extension. That first switch turns the window into an untitled multi-root workspace and
  restarts the extensions once; open session tabs keep running, and the folders that leave become added projects. It
  then offers once to save the workspace, which names it Aggregor instead of Untitled and stops the save question when
  the window closes.
- **Terminals.** The Terminal panel's + opens in the shown project without asking. Its project button opens a shell in
  any of the window's projects, shown or not.
- **Persistent sessions.** Sessions survive reloads and restarts, and every window that lists their project shows them.
  Closing a tab keeps the session listed as exited; clicking it resumes the conversation. The row's … menu removes a
  session.
- **Session titles.** Each tab and row shows the title the agent gives its terminal, as it changes (for Claude, its own
  title for the conversation or the one set with `/rename`); a closed session keeps the last one. Rename in the row's …
  menu gives a session your own name in the row and the tab; an empty name hands both back to the agent.
- **Live status.** Each row ends with a status badge: a blue spinner while the agent works, a yellow dot when it waits
  on you (the row says for what: permission, a question or a sign-in, and the tooltip shows the agent's message) and a
  red cross on an error. A turn that finishes while you are looking elsewhere leaves a green check until you open that
  session's tab; a session you have seen shows no badge, and a grey hollow dot means it has exited. Reported progress
  shows next to the name. The status comes from the agent's own OSC 7501 reports, read by `aggregor-pty`, which runs
  every session's agent; the Linux and macOS builds carry it, and on Windows sessions run in WSL.
- **AI commit messages.** A Source Control button writes the commit message for the staged diff.

## Roadmap

Each item is one small PR, stacked on the previous one. Releases wait for the end of a milestone.

[phase2.md](phase2.md) plans the next stack step by step: agents from settings, status from OSC 7501, SQLite storage,
tmux and alerts.

### M1: local Claude sessions

- [x] Sessions sidebar: start Claude in an editor tab, list and focus sessions
- [x] Persist and resume: sessions survive reloads; clicking a closed one runs `claude --resume`
- [x] Cleanup before the first release: remove dead ACP, webview and React code, align `@types/vscode` with `engines`
- [x] Live status: running, needs input, idle and exited (from Claude Code hooks then, from OSC 7501 now)

### M2: alerts, multi-project

- [ ] Needs-input alerts: activity-bar badge and a notification for background sessions
- [ ] tmux persistence: closing a tab detaches instead of killing the agent; clicking reattaches
- [x] Projects: an extension-owned project list, tree grouped as project > session

### M3: worktrees and review

- [ ] Worktree mode: start a session in the project root or in a new git worktree
- [ ] Changed files under each session, opening git's diff with per-hunk staging
- [ ] Accept (stage), reject (restore) and review all changes
- [ ] Archive sessions: remove the worktree, keep unmerged branches
- [ ] Bookmarks
- [ ] Create a pull request from a session

### M3: SSH

- [ ] One command path for local and remote targets
- [ ] SSH hosts in the sidebar, sessions running in tmux on the host
- [ ] Live status for remote sessions
- [ ] Remote changed files and "Open in Remote Window"

### M4: more agents

- [ ] Gemini CLI
- [ ] OpenCode
- [ ] Codex

### Later

Read-only diffs for SSH sessions in the local window, per-turn checkpoints, screen-based status for agents without OSC
7501, cloud hosts through SSH config, and VS Code's agent sessions API if it becomes stable.

## Development

See [AGENTS.md](AGENTS.md) for the commands. Press F5 in VS Code to run the extension.
