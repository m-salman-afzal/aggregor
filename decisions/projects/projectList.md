# Project list

Which projects the Sessions view lists.

## One project list for every window

- **Problem:** the user works in one VS Code window that holds all their projects, so a list per window is machinery
  they don't use.
- **Decision:** the `projects` table is the list: `isAdded` (named `added` before) marks a listed project, Add Project
  upserts it with `isAdded` (to the end of the list), and Remove Project clears it; its sessions stay and come back with
  it. A workspace folder's project gets a row with its first session without being added, so it stays one of the
  window's own folders. One anchor folder, `~/.aggregor/anchor/Aggregor`. The windows tables went with a generated
  migration, which leaves every project unadded. Less to build and keep. Adding windows back is one table and a
  migration. Since sessions run in tmux, a second window shows the same sessions and opening a running one attaches to
  its tmux session; before, it would start a second agent on its id.
- **Alternatives considered:** a list per window, by the window's key: a `windows` row per key and a `windowProjects`
  row per added project, plus an anchor folder per key; the key survived the switch to an untitled workspace, whose
  `workspaceState` starts empty. Before that, `workspaceState`, which loses the list at that switch, and `globalState`
  under the window's key.

## Listed projects are `ProjectListItemDto`s

- **Problem:** a workspace folder is listed before its project has a row, so a listed project can't be the stored
  `ProjectEntity`.
- **Decision:** `ProjectService.listProjects` returns `ProjectListItemDto`s (path, name, isAdded), built from the
  workspace folders and the added projects; a project's row is made the first time it is added or given a session. Until
  these were `ListedProjectValueObject`s, but a project identified by its path is no value object.
