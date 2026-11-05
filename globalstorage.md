# Global storage

What the extension keeps in VS Code's storage, and why. Append an entry whenever something new is stored.

`globalStorageUri` and `globalState` are shared by every window; `workspaceState` belongs to one workspace. All three
survive reloads, restarts and extension updates.

## Files under `globalStorageUri`

A folder the extension owns. On Linux it is `~/.config/Code/User/globalStorage/salmanafzal.aggregor-app/`. Use it for
data that processes other than the extension write, or that is too big for `globalState`.

### `anchors/<window key>/`

- **Holds:**
  - `Aggregor/`, the anchor folder: empty but for `.vscode/settings.json`, with `files.exclude` set to `{"**": true}`
    and `terminal.integrated.cwd` set to the shown project. Save Workspace As suggests saving
    `Aggregor/Aggregor.code-workspace`, so a saved workspace usually lives here too.
  - `saveOffered`, an empty file: the window was offered to save its workspace.
- **Written by:** `WorkspaceInfraService`: the settings before every project switch, the marker when it offers; VS Code,
  the workspace file when the user saves it there.
- **Read by:** VS Code, as that window's folder 0, which its own settings hide from Explorer; `WorkspaceInfraService`
  checks the marker.
- **Why:** with the anchor folder at folder 0, the shown project swaps at folder 1; changing folder 0 restarts every
  extension. Its terminal cwd makes New Terminal count it and the project as one folder, so it opens in the project
  without asking. Named `Aggregor`, it names the saved workspace and its row in folder pickers. The marker makes the
  offer once per window.
- **Cleaned up:** never; each is an empty folder, a settings file of a few hundred bytes, an empty marker and maybe a
  workspace file.
- **Added in:** one project in view (M2).

### `status/<session id>`

- **Holds:** one word: `running`, `needs-input`, `idle` or `exited`.
- **Written by:** the Claude Code hooks in [hooks.json](apps/extension/assets/hooks.json). Each session's terminal gets
  the file's path in the `AGGREGOR_STATUS_FILE` env var.
- **Read by:** `ClaudeCodeHarnessInfraService`, which watches the folder and feeds the Sessions tree.
- **Why:** live status. Hooks are shell one-liners, so a plain file is the simplest thing they can write, and every
  window can watch the same folder.
- **Cleaned up:** deleted before each launch and when the session is removed. Removing a running session can leave the
  file behind, because the agent's `SessionEnd` hook may write after the delete. Each leftover is a few bytes.
- **Added in:** live status (M1).

## Keys in `globalState`

VS Code's key-value store for the extension, kept in its own database rather than in the folder above. Use it for small
JSON the extension alone reads and writes.

### `agentSessions`

- **Holds:** `{version: 1, sessions: [{id, name, customName?, projectPath, harnessId}]}`: the `StoredSessionsModel`
  (`infrastructure/database/models/`). `name` is the agent's latest title, or ours until it gives one; `customName` is
  the user's, from the row menu's Rename.
- **Written by:** `SessionRepository`, with a read-modify-write on every add, remove and rename, and when an agent's
  title changes.
- **Read by:** `SessionRepository` at startup and whenever a window regains focus.
- **Why:** sessions survive reloads and are shared by every window.
- **Cleaned up:** an entry goes when its session is removed. Removing a project keeps its sessions, so adding the
  project again lists them again. Any change to the shape bumps `version`, so older windows refuse to decode it instead
  of overwriting it.
- **Added in:** session titles from the terminal (M2), replacing `savedSessions`.

### `addedProjectPathsByWindow`

- **Holds:** `{version: 1, addedProjectPathsByWindow: {<window key>: [path]}}`: the `StoredAddedProjectPathsModel`, the
  absolute paths added with Add Project, one list per window. A window's key is its anchor folder's directory name once
  it has one, else its first folder's name and a hash of its path (`findWindowKey` in `infrastructure/utils/`), which is
  the name its anchor folder's directory gets. A window without folders is `window-` and a hash of its session id; its
  first Add Project gives it an anchor folder at once, which keeps the key. Workspace folders are not stored.
- **Written by:** `ProjectRepository`, with a read-modify-write that keeps the other windows' lists, on every Add
  Project and Remove Project, and when folders leave the workspace for the shown project.
- **Read by:** `ProjectRepository` at startup and before every write.
- **Why:** each window lists its own projects. It is not in `workspaceState` because the first project switch turns a
  single-folder window into an untitled multi-root workspace, which VS Code starts with an empty `workspaceState`; the
  window key stays the same.
- **Cleaned up:** Remove Project drops the path. A window's list stays, possibly empty, after its folder is gone; each
  is a few hundred bytes. Any change to the shape bumps `version`, as for `savedSessions`.
- **Added in:** one project in view (M2), replacing the `workspaceState` key `addedProjectPaths`.

### `sessions`, `storedSessions` and `savedSessions` (no longer read)

- **Holds:** sessions in older shapes: `sessions` with `cwd` and no `version`, `storedSessions` with `repoPath`,
  `savedSessions` without `customName`.
- **Read by:** nothing. Nothing deletes them either; each is a few hundred bytes. A new key must not reuse either name,
  since their values would fail to decode and block every write.

## Keys in `workspaceState`

The same kind of key-value store as `globalState`, but one per workspace: only a window on that workspace sees it.

### `addedProjectPaths` (no longer read)

- **Holds:** `{version: 1, addedProjectPaths: [path]}`, the added paths before they moved to `globalState`.
- **Read by:** nothing. VS Code deletes it with the workspace's storage.

### `addedRepoPaths` (no longer read)

- **Holds:** the paths added before the repo-to-project rename.
- **Read by:** nothing. VS Code deletes it with the workspace's storage.
