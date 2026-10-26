# Global storage

What the extension keeps in VS Code's storage, and why. Append an entry whenever something new is stored.

`globalStorageUri` and `globalState` are shared by every window; `workspaceState` belongs to one workspace. All three
survive reloads, restarts and extension updates.

## Files under `globalStorageUri`

A folder the extension owns. On Linux it is `~/.config/Code/User/globalStorage/salmanafzal.aggregor-app/`. Use it for
data that processes other than the extension write, or that is too big for `globalState`.

### `status/<session id>`

- **Holds:** one word: `running`, `needs-input`, `idle` or `exited`.
- **Written by:** the Claude Code hooks in [hooks.json](apps/extension/assets/hooks.json). Each session's terminal gets
  the file's path in the `AGGREGOR_STATUS_FILE` env var.
- **Read by:** `StatusService`, which watches the folder and feeds the Sessions tree.
- **Why:** live status. Hooks are shell one-liners, so a plain file is the simplest thing they can write, and every
  window can watch the same folder.
- **Cleaned up:** deleted before each launch and when the session is removed. Removing a running session can leave the
  file behind, because the agent's `SessionEnd` hook may write after the delete. Each leftover is a few bytes.
- **Added in:** live status (M1).

## Keys in `globalState`

VS Code's key-value store for the extension, kept in its own database rather than in the folder above. Use it for small
JSON the extension alone reads and writes.

### `sessions`

- **Holds:** `{version: 1, sessions: [{id, cwd, name}]}`.
- **Written by:** `SessionStore`, with a read-modify-write on every add and remove.
- **Read by:** `SessionStore` at startup and whenever a window regains focus.
- **Why:** sessions survive reloads and are shared by every window.
- **Cleaned up:** an entry goes when its session is removed. Removing a repo keeps its sessions, so adding the repo
  again lists them again. Any change to the shape bumps `version`, so older windows refuse to decode it instead of
  overwriting it.
- **Added in:** persist and resume (M1).

## Keys in `workspaceState`

The same kind of key-value store as `globalState`, but one per workspace: only a window on that workspace sees it.

### `repos`

- **Holds:** `{version: 1, repos: [path]}`, the absolute paths added with Add Repo. Workspace folders are not stored.
- **Written by:** `RepoStore`, with a read-modify-write on every Add Repo and Remove Repo.
- **Read by:** `RepoStore` at startup and before every write.
- **Why:** each window lists its own repos, so sessions started in one workspace don't show in the others.
- **Cleaned up:** Remove Repo drops the path. VS Code deletes the key with the workspace's storage. Any change to the
  shape bumps `version`, as for `sessions`.
- **Added in:** repos (M2).
