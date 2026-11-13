# Workspace

The project in view, and the workspace file Aggregor writes for it.

## One project in view, behind a hidden anchor folder

- **Problem:** with every project a workspace folder, Explorer, search, file watching and Source Control span all of
  them, and git watches each repository recursively. Changing workspace folder 0 restarts every extension; only VS
  Code's own Agents window is exempt.
- **Decision:** the first switch puts a hidden anchor folder (`~/.aggregor/anchor/Aggregor`) at folder 0 and the viewed
  session's project at folder 1, by opening Aggregor's workspace file (see "Aggregor's workspace is a file Aggregor
  writes"); later switches swap only folder 1. Session terminals carry `AGGREGOR_SESSION_ID` in their env, so they are
  found again after an extension restart, and the anchor's `terminal.integrated.cwd` makes New Terminal open in the
  shown project. One reload instead of an extension restart per switch. TypeScript, ESLint, Prettier, rust-analyzer and
  Lua all follow the shown project; mise needs `mise.selectWorkspaceFolder` after each switch.
- **Alternatives considered:** swap folder 0 on each switch, restarting every extension each time; an extension-owned
  anchor at folder 0.

## Aggregor's workspace is a file Aggregor writes

- **Problem:** the first switch turned the window into an unsaved multi-root workspace, named Untitled, which asks to be
  saved when the window closes; no API saves one silently, so the window offered once to open Save Workspace As , a
  dialog on a fresh start.
- **Decision:** the first switch, in a window that isn't a saved workspace with the anchor folder at folder 0, writes
  `~/.aggregor/anchor/Aggregor.code-workspace` (the anchor folder, then the project) and opens it in the window with
  `vscode.openFolder` (`forceReuseWindow`). Opening it reloads the window, which closes the session tabs, whose agents
  keep running, so `sessionToReopen.json` beside it keeps the session being switched to and the reloaded window opens it
  (`WorkspaceService.startSessionReopenAfterReload`); one older than a minute is ignored. Later switches swap folder 1,
  which VS Code writes into the file. A workspace saved earlier with the anchor at folder 0 is kept. Add Project in an
  empty window opens the file the same way, with no session to reopen. No question, ever; the window is named Aggregor
  and shows in Open Recent.
- **Solution:** the first switch reloads the window instead of only restarting the extensions, so editors and terminals
  come back as after any reload. When another window already has the file open, VS Code shows that window and this one
  stays as it was; the session to reopen then expires unused.
- **Alternatives considered:** VS Code's `window.confirmSaveUntitledWorkspace`, a user setting that would stop the
  question for every untitled workspace and discard them on close.

## The shown project's own settings sync with Aggregor's workspace file

- **Problem:** in a workspace with several folders, VS Code reads a folder's `.vscode/settings.json` only for settings
  scoped to a resource, and Aggregor's workspace always has two, the anchor folder and the project. Every other setting
  in a project's own file was ignored, VS Code's and every extension's, `aggregorApp.commitCommand` included. The other
  way round, VS Code and extensions write a window's "workspace" settings into the workspace file, so an edit that lands
  in the project's own file when the project is open alone, such as Peacock's color, never reached it.
- **Decision:** `WorkspaceInfraService` syncs the shown project's `.vscode/settings.json` with the `settings` of
  `~/.aggregor/anchor/Aggregor.code-workspace`, both ways, against the last copy, which `copiedProjectSettings.json`
  beside the workspace file keeps with its project's path. A setting changed in the project's file since then takes the
  project's value; one changed only in the workspace file is written into the project's file, alone, with its comments
  and indentation kept, and the project's file wins when both changed. With no last copy of the project, its settings
  replace the workspace file's. Each sync writes the project's file first, then the workspace file, then the last copy,
  so a failure, such as the project's file having unsaved changes in an editor, leaves the edits for the next one. Both
  files are written through VS Code's own copy of them (`openTextDocument`, one edit for the whole text, then a save),
  which its settings writes and every extension's share, so none of them finds the file changed under it. A sync runs
  when the window starts, on every settings change VS Code makes, when the folders change and when the shown project's
  own `.vscode/settings.json` changes, one at a time behind a lock that a switch holds too. A switch syncs the leaving
  project, copies the next one's settings in before its folder, so an extension that reads them as the folders change,
  as Peacock does, finds them already there, then swaps the folder and syncs again. The first switch, which writes the
  workspace file anew, syncs the last copy's project first. String values starting with `./` or `../` become absolute
  paths in the project, and `${workspaceFolder}` and `${workspaceFolderBasename}` its path and name; a relative path
  written in the workspace file goes into the project's file relative to the project. Files are parsed and edited with
  `jsonc-parser` (3.3.1, Microsoft's, as VS Code uses). A window showing several projects syncs nothing. The workspace
  level takes every setting but application- and machine-scoped ones, VS Code applies a change to the file without a
  reload, and edits land where they would with the project open alone, so the project's own settings work as then,
  Peacock included. Writing through VS Code's copy and in turns keeps every writer from racing another.
- **Solution:** a string that starts with `./` or `../` but isn't a path is made one too. An extension that rewrites its
  own settings whenever they change, as Peacock does, can still be caught mid-write by a switch; copying the next
  project's settings in first leaves it one value to apply. A switch while the leaving project's file has unsaved
  changes drops that project's pending workspace edits. A workspace the user saved with the anchor folder at folder 0
  isn't synced, since its settings are the user's.
- **Alternatives considered:** scoping Aggregor's commit settings to a resource and reading them with the project's
  folder, which fixes those two alone. Opening each project as a plain folder, which reloads the window on every switch.
  Keeping the last copy in the database, a table, repository and migration for one JSON value. Writing through VS Code's
  settings API, one write per key, which refuses the keys of extensions that aren't installed. A one-way copy written
  straight to the file (the first version, the same day): it replaced Peacock's color with the project's on the next
  switch, its write raced VS Code's own save of the folder swap ("File Modified Since", a compare-or-overwrite prompt,
  and the swap timing out), and with two colors in play Peacock's writes traded them back and forth every second.

## A project switch writes the workspace file's folders, with the project's settings

- **Problem:** the user's window stopped following the sessions: VS Code showed one project, while every switch failed
  at once with `WorkspaceFoldersUpdateRejectedError`. VS Code 1.145.3's extension host keeps each
  `updateWorkspaceFolders` change unconfirmed until VS Code reports its folders changed or refuses it; while one is
  unconfirmed it refuses every later call and reports the unconfirmed folders as the workspace's. VS Code's folder write
  edits the workspace file's buffer, saves it without checking the save, and rereads the file: when the save doesn't
  land, nothing changes, nothing is reported, and the host stays wedged until the window reloads. Aggregor then synced
  the wrong project's settings into the file on every change, and Source Control never heard of a folder change.
- **Decision:** a switch in a saved workspace with the anchor at folder 0 writes the file's `folders` (the anchor
  folder's entry as written, then the project) and, in Aggregor's workspace, the project's `settings`, in one edit and
  save through VS Code's copy, then waits up to 5 seconds for the folders to change. VS Code rereads the file and
  reports it, which also clears an unconfirmed change another extension or VS Code left behind. An edit that leaves the
  file's folders as they were waits for nothing. When the wait times out, the project goes out of the file and back in,
  two changes VS Code sees whatever it shows, and when that times out too the window reloads with the session to reopen.
  The copy is written before the file, and the anchor folder's settings after a swap, so a failed switch leaves both
  with the project still shown. Removing a project rewrites the file's folders the same way; a window without a saved
  workspace file still uses `updateWorkspaceFolders`. VS Code reports a change it reads from the file as it does any
  edit of the file, so no change waits on a confirmation that may never come; and Peacock finds the new color in the
  same write as the folder.
- **Solution:** the file's folders are written as absolute paths. A project whose settings can't be read comes in with
  the last project's settings, as before. When VS Code left its own folder change unconfirmed and the extension host
  believes in that project, viewing that very project changes nothing, since the host counts it as shown, until another
  project is viewed.
- **Alternatives considered:** keeping `updateWorkspaceFolders` and reloading the window whenever it is refused or times
  out, a reload each time; only telling the user to reload.

## A settings file with unsaved changes waits; the workspace file's are saved

- **Problem:** a write whose edit applied but whose save failed left the edit unsaved in VS Code's copy, and from then
  VS Code refused every settings write ("the file has unsaved changes"), Aggregor's syncs and switches included; the
  user's window showed this for 40 seconds. Another writer's save in flight also made Aggregor's write give up at once.
- **Decision:** a save that VS Code reports failed is tried again, 8 times 250 ms apart, which saves the edit or finds
  another writer's save already did; a file with unsaved changes is checked again as often. A project's own settings
  file still unsaved after that is left alone, as an editor's changes are. The window's workspace file still unsaved is
  saved, with a warning, since its unsaved changes are a write VS Code or an extension failed to save. The errors say
  which step failed: `SettingsFileNotOpenedError`, `SettingsFileEditRejectedError`, `SettingsFileNotSavedError`.
  Transient save failures pass on their own, and Aggregor's workspace file belongs to Aggregor, so saving what another
  writer left there unblocks every writer.
- **Solution:** a save that keeps failing, as with a read-only file, still leaves the edit unsaved, with VS Code's own
  Overwrite prompt; a user's unsaved edit of the workspace file in an editor is saved after 2 seconds.
- **Alternatives considered:** writing the files straight to disk, which makes a writer whose edit is in VS Code's copy
  fail with "File Modified Since"; reverting VS Code's copy, which no API does outside an editor.

## An edit keeps the indentation of the file's top-level properties

- **Problem:** on 0.0.9 the user's `Aggregor.code-workspace` grew to 32 MB, nearly all spaces. VS Code's memory rose,
  the window froze, saves failed with "File Modified Since" and the Overwrite prompt, and the file, cut short mid-write,
  could no longer be read, so every switch failed, reload or not. The first switch writes the file as one line of JSON,
  and a later edit leaves `{"folders":[` on its first line, so the file's first indented line is a folder entry, two
  levels deep. An edit took that line's indentation as one level and re-indented the value it wrote with it, doubling
  the indentation each time; 0.0.9 writes both `folders` and `settings` on every switch, so about 20 switches made 32
  MB.
- **Decision:** an edit takes the indentation of the first top-level property that starts its own line, found with
  `jsonc-parser`'s `parseTree`, else 4 spaces; the first switch writes the workspace file indented with 4 spaces. A
  top-level property is one level deep in any file, whatever its first line holds; and a file the old edit bloated,
  whose properties share their lines with `{"folders":[` and `],"settings":{`, gets 4 spaces back on the next switch,
  which rewrites both values.
- **Solution:** Verified: in the headless VS Code, four projects switched 20 times kept each one's file size, 293 to
  2,183 bytes; a 123 KB file planted with the old doubling came back to 2,170 bytes on the next switch and stayed there
  over 12 more. A workspace file that can't be read, as the user's cut-short one, still fails every switch until it is
  rewritten.
- **Alternatives considered:** always indenting with 4 spaces, which re-indents a project's own settings file the user
  indents otherwise; the smallest indentation in the file, which a block comment can set and which keeps a bloated file
  as it is.
