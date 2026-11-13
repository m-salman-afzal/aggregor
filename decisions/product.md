# Product

What Aggregor is, and the order its big pieces come in.

## Agents run in their own terminal UIs

- **Problem:** T3 Code, Conductor and Orca each build a UI around coding agents; aggregor wants their features inside a
  normal VS Code window.
- **Decision:** each agent's native TUI (Claude Code first; Gemini CLI, OpenCode and Codex later) in a terminal opened
  as an editor tab, managed from a native TreeView. VS Code already has terminals, trees, watchers, Source Control and
  diffs; rebuild nothing it ships, and use only stable APIs.
- **Alternatives considered:** an ACP client with a webview chat UI (the first prototype; its dead code went in the M1
  cleanup); VS Code's chat sessions API, which is proposed and so unusable from a Marketplace extension; each agent's
  own TUI.

## Review agent edits with git

- **Decision:** the index is the accepted baseline: staging accepts a change and restoring rejects it, in git's own diff
  with per-hunk staging. No custom diff UI. Same as above: Source Control and its diffs already exist.

## Where sessions run: {local, SSH host} × {project root, git worktree}

- **Decision:** SSH is a must-have, and closing a tab must never kill the agent; tmux (M2) detaches it, and clicking the
  session reattaches.

## Webview first, then worktrees, then a tray

- **Problem:** worktree mode would add a branch and a worktree to every session row, and the tree had no room for them;
  the user also wants to manage sessions from a tray icon, with VS Code closed too, and asked whether the front end and
  the backend should be apps of their own.
- **Decision:** the webview stack, then worktrees (on the Git extension API, as agreed for worktrees 1), then the tray
  as milestone M6. How the backend runs without VS Code is decided when M6 starts, within `DDD.md`'s layers; until then
  nothing is built for it. The front end doesn't change when the backend later moves, and `DDD.md`'s ports already keep
  VS Code behind interfaces, so a later split moves layers whole instead of rewriting them.
- **Alternatives considered:**
  - Splitting now: an `apps/server` daemon owning the sessions (as Orca, Paseo, T3 Code and VS Code's Agent Host do),
    `packages/domain` and `packages/api` with the DTOs and Effect RPC groups, and the extension relaying the webview's
    calls to it. Turned down: it pulled the domain and the DTOs out of their layers and put an RPC layer beside the
    controllers, against `DDD.md`, for a tray that isn't being built yet.
  - A terminal client, light like neovim, with the sessions in a side pane: parked in the roadmap's "If the users
    asked".
