# aggregor

Run coding agents (Claude Code, later Gemini, OpenCode and Codex) in their own terminal UIs, managed from a VS Code
sidebar. The idea behind T3 Code, Conductor and Orca, built on what VS Code already has: terminals, tree views, Source
Control and diffs.

## What works today

- **Sessions sidebar.** The Aggregor App activity-bar view starts Claude Code in an editor-tab terminal for a workspace
  folder and lists its sessions. Clicking a session focuses its tab; switching tabs selects the session.
- **Persistent sessions.** Sessions survive reloads and restarts and are shared by every window. Closing a tab keeps the
  session as "closed"; clicking it resumes the conversation. The row's close button removes a session.
- **Claude's session names.** Each row shows the name Claude gives the conversation (or the one set with `/rename`),
  updated live as Claude renames it.
- **AI commit messages.** A Source Control button writes the commit message for the staged diff.

## Roadmap

Each item is one small PR, stacked on the previous one. Releases wait for the end of a milestone.

### M1: local Claude sessions

- [x] Sessions sidebar: start Claude in an editor tab, list and focus sessions
- [x] Persist and resume: sessions survive reloads; clicking a closed one runs `claude --resume`
- [x] Cleanup before the first release: remove dead ACP, webview and React code, align `@types/vscode` with `engines`
- [ ] Live status: running, needs input, idle and exited, from Claude Code hooks

### M2: alerts, multi-repo

- [ ] Needs-input alerts: activity-bar badge and a notification for background sessions
- [ ] tmux persistence: closing a tab detaches instead of killing the agent; clicking reattaches
- [ ] Repos: an extension-owned repo list, tree grouped as repo > session

### M3: worktrees and review

- [ ] Worktree mode: start a session in the repo root or in a new git worktree
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

Read-only diffs for SSH sessions in the local window, per-turn checkpoints, screen-based status for agents without
hooks, cloud hosts through SSH config, and VS Code's agent sessions API if it becomes stable.

## Development

See [AGENTS.md](AGENTS.md) for the commands. Press F5 in VS Code to run the extension.
