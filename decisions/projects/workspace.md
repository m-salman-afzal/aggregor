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

## Quick switches go straight to the last session viewed

- **Problem:** each change of the session in view switched the window's project in turn, about a second each (Source
  Control opening the repository, then the folder swap), so clicking through several sessions quickly queued a switch
  per click, and the window walked through every project in between.
- **Decision:** a switch already running finishes, and of the sessions viewed meanwhile only the last one is switched to
  next; the ones in between are skipped. A switch writes the workspace file and syncs settings behind a lock, so it is
  never cut short.
- **Solution:** `startShownProjectSync` reads the changes of `viewedSessionId` through a one-slot sliding buffer
  (`Stream.buffer({capacity: 1, strategy: "sliding"})`). Verified in the headless VS Code: five clicks 250 ms apart over
  three folders ran three switches and ended on the last session.
- **Alternatives considered:** a switch per change, in order (the first version); interrupting the running switch for
  the next one (`Stream.switchMap`), which could stop it mid-write, the way earlier failed writes wedged the window.

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
  `jsonc-parser` (3.3.1, Microsoft's, as VS Code uses). A window showing several projects syncs nothing, and neither
  does a project whose folder is gone: a worktree deleted while shown is still the window's folder when the switch away
  syncs it, and in any other window until its next switch, and writing a workspace edit into its settings file brought
  the folder back with only `.vscode/settings.json` in it. The workspace level takes every setting but application- and
  machine-scoped ones, VS Code applies a change to the file without a reload, and edits land where they would with the
  project open alone, so the project's own settings work as then, Peacock included. Writing through VS Code's copy and
  in turns keeps every writer from racing another.
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

## Each folder has one shell in tmux, shown in the window's one Aggregor terminal, which follows the session in view

- **Problem:** each folder a session works in had a VS Code terminal of its own, and the Terminal panel followed the
  shown session by bringing that folder's terminal to the front. VS Code brings a terminal to the front only by showing
  it, which opens a hidden panel: `Terminal.show` does, with or without the focus, and so does every built-in command
  that changes the panel's terminal (read in 1.146's source). An extension can't read whether the panel is open either
  (microsoft/vscode#10471), so it could not switch only an open panel, and a hidden panel opened on every switch to
  another folder. A folder's dev server also ended with the window.
- **Decision:**
  - Each folder a session works in has one shell, in a tmux session of its own on Aggregor's tmux server, the one the
    agents run on (see [terminals.md](../sessions/terminals.md)). A window has one terminal for them, named Aggregor, in
    the Terminal panel: a tmux client. Changing folder is tmux attaching that client to another tmux session, which VS
    Code never sees, so the panel stays as it is.
  - When the session in view changes, an open Aggregor terminal moves to the shell of that session's folder, started
    first when it isn't running, and the Terminal panel stays open or hidden as it was. With no Aggregor terminal open,
    nothing opens.
  - The terminal VS Code opens by itself in Aggregor's workspace, when the panel shows with no terminal in it, is the
    Aggregor terminal, on the shell of the session in view's folder, or of the folder shown in the window with no
    session in view. A plain VS Code terminal there could never follow the session in view.
  - The terminal button on a project's row shows the terminal on the project's shell; the one on a session's row, on the
    shell of the session's folder: its project's for a root session, its worktree's for a worktree session, shared by
    every session in that worktree. Both are Open Terminal, open the panel, and start the shell when it isn't running.
    Archived rows have none, and the … menus don't repeat it.
  - The shell is the user's own, started as tmux starts one: `$SHELL`, as a login shell. It doesn't depend on VS Code's
    terminal profile, which nothing outside VS Code can read.
  - The shell sees no tmux: `TMUX` and `TMUX_PANE` are unset, so the user's own tmux runs there as in a plain terminal,
    and a tmux command typed there never reaches Aggregor's server.
  - On Linux with a systemd user manager, each shell runs in a scope of its own, as each agent does, so a runaway dev
    server is killed alone and what a shell started can be told apart from the rest.
  - One terminal shows every folder, so tmux draws a status line at its bottom that names the folder: the project's
    name, or `‹project› · ‹worktree folder›`.
  - The panel's trash icon ends the shell on screen; the other folders' shells keep running. `exit` ends the shell it is
    typed in. Deleting a worktree, by Remove or the leftovers cleanup, ends its shell, and removing a project ends its
    shell and those of its sessions' worktrees. A window reload, a quit and a closed window only detach: the shell, and
    what runs in it, stays, and the next Open Terminal attaches to it.
  - A shell keeps 100,000 lines of history, twice an agent's.
  - The Aggregor terminal draws what tmux sends, as a session's tab does: tmux keeps the lines that scrolled off (the
    wheel scrolls them, with no scrollbar), VS Code's Find sees only the screen, and shell integration (the marks beside
    each command, Run Recent Command, quick fixes) is off, since tmux starts the shell. While the Aggregor terminal is
    open, a terminal from the panel's + is a plain VS Code terminal with all of these, in the shown project; with none
    open, + opens the Aggregor terminal.
- **Solution:**
  - `FolderShellService` holds the use cases: `openProjectTerminal` and `openSessionFolderTerminal` (the commands
    `aggregorApp.openProjectTerminal` and `aggregorApp.openSessionFolderTerminal`) switch the open terminal, or open
    one, `startFolderShellFollow` moves it with the session in view, and `startFolderShellEndOnTerminalClose` ends the
    shell the user closed. The application names a shell by its folder's path; its tmux session's name,
    `shell-‹folder›-‹6 hex digits from its path›`, comes from the domain's `getFolderShellName` and never leaves
    `TmuxInfraService`. The running-agents list skips these names, which are no session ids.
  - With no terminal open, `ITmuxInfraService.prepareFolderShellTerminalCommand` builds the command the new terminal
    runs, one tmux command list:
    `tmux -S ‹socket› -f ‹conf› -u new-session -A -s ‹name› -c ‹folder› -- sh -c 'unset TMUX TMUX_PANE; exec "$@" "$SHELL" -l' sh [systemd-run --user --scope --quiet --collect --] ; set-option -t =‹name›: status on ; set-option -t =‹name›: history-limit 100000 ; set-option -t =‹name›: @aggregor_folder_label ‹label›`.
    The terminal's own tmux client starts the shell, so the shell gets what VS Code gives a terminal, git's credential
    helper among it, and `-A` attaches when the shell already runs. `assets/tmux.conf` draws the status line from the
    session's `@aggregor_folder_label`, which tmux doesn't read as a format, so any folder name shows as it is.
  - With the terminal open, `showFolderShellInTerminal` finds its tmux client by the terminal's process id, as the
    shared session tab's switch does, and runs `switch-client -E`. A shell not running yet is started first, detached,
    by the extension, whose own process lacks VS Code's terminal variables: it passes each variable of the shell on
    screen (`show-environment`) with `-e`. A terminal just opened has no client for a moment, so the lookup is tried
    every 50 ms for up to a second, which also covers a double-click.
  - The follow reads the changes of `viewedSessionId` through a one-slot sliding buffer, as the project switch does, so
    quick clicks end on the last session, and runs the same switch with the session's folder. A session removed
    meanwhile, or whose project is no longer listed, moves nothing; any other failure is logged, since no command
    started it.
  - `TerminalInfraService` keeps which folder's shell the terminal shows, as tmux last said: the use case reads the
    client's `session_path` (`readFolderShellPathShownInTerminal`) after every switch and when the extension starts, and
    hands it over (`assignShownFolderShellPath`). When the terminal closes with `TerminalExitReason.User`,
    `folderShellPathsClosedByUser` yields that folder; a reload or a quit reports another reason, and tmux can no longer
    say what a closed client showed.
  - Aggregor contributes a terminal profile, Aggregor (`aggregorApp.folderShell`), and Aggregor's workspace file sets
    `terminal.integrated.defaultProfile.linux` and `.osx` to it (`AGGREGOR_WORKSPACE_SETTINGS`), so every terminal VS
    Code opens without a profile picked goes through `FolderShellProfileView`'s provider. Its use case,
    `prepareProfileTerminal`, returns the Aggregor terminal's launch options, the same
    `prepareFolderShellTerminalOptions` the row's button launches with, while no Aggregor terminal is open, and no
    options otherwise, which VS Code launches as its own shell; a failure, such as tmux missing, is logged and opens VS
    Code's shell too. The settings join the shown project's in `prepareWorkspaceSettings`, so the settings sync counts
    them as the project's and never writes them into its file; they override a project's own default profile. VS Code
    honours a default profile only in a trusted workspace.
  - The terminal is found by its name, Aggregor, after an extension restart, a window reload and a quit alike: VS Code
    restores a terminal with its name but without the env it was launched with. It is not transient: it stays through a
    window reload, and after a quit VS Code restores it by running its command again, which attaches to the shell of the
    folder it opened with; the startup sync then reads from tmux which shell it shows. A terminal the user renames is no
    longer found, and one the user names Aggregor is taken for it. It starts in the Aggregor folder, since VS Code
    labels a terminal's tab with the folder it started in, which would name a folder the terminal no longer shows.
  - tmux reads a `#` in a folder it is given as the start of a format, so a path's `#` is doubled, for a shell's folder
    and an agent's alike; left as it is, a folder named `C#Samples` starts in a folder that doesn't exist.
  - Verified in the headless VS Code: Open Terminal on a project opened one Aggregor terminal on its shell, with the
    status line; on a worktree session it switched that terminal in place in about 40 ms, and with the worktree's shell
    ended first it started the shell with the shown shell's 12 variables, `GIT_ASKPASS` among them; a double-click ran
    twice and opened one terminal; the trash icon ended only the shell on screen, also after an extension restart on a
    terminal that had switched folder; `exit` ended the shell and closed the terminal; Remove on a worktree session
    ended its shell; and the reload into Aggregor's workspace closed the terminal with the shell left running. With the
    terminal on the project's shell, viewing a worktree session moved it to the worktree's shell, started then, in about
    100 ms, and viewing the root session moved it back, with the panel open and again with it hidden, where it stayed
    hidden; before any terminal was open, a change of view opened none.
  - Limits: tmux before 3.7 sizes a pane's history as the pane is made, so there a shell keeps an agent's 50,000 lines.
    Without a systemd user manager (macOS, WSL without systemd, a container) a shell runs in the tmux server's cgroup.
    The first switch into Aggregor's workspace reloads the window, which closes the terminal; the shell runs on.
- **Alternatives considered:**
  - A VS Code terminal per folder, the panel following by bringing the folder's terminal to the front, only while the
    panel showed another folder's terminal (the earlier decision): it opened a hidden panel on every folder change.
  - Still with VS Code terminals: bringing the folder's terminal to the front only once the user moves into the panel,
    which leaves an open panel on the old shell until then; dropping the follow for the row's button alone; Aggregor
    taking over Ctrl+Backquote to open the panel on the right shell, which a focused session tab sends to its agent
    unless the command is on `terminal.integrated.commandsToSkipShell`; switching and then closing the panel again,
    which would close a panel the user had open.
  - Moving the Aggregor terminal only on Open Terminal: after each switch of session it shows another folder's shell.
  - Skipping the switch when the terminal already shows the folder: switching to the shell on screen changes nothing,
    and costs one tmux round trip a change of view.
  - Leaving `TMUX` set in the shell: the user's own `tmux` refuses to start there ("sessions should be nested with
    care"), and `tmux split-window` typed there splits Aggregor's session.
  - A second tmux server for shells: two servers to find, configure and keep apart for no gain.
  - VS Code's default terminal profile as the shell, which a tray icon, with VS Code closed, could not read.
  - No status line, relying on the prompt: with a dev server printing there is no prompt on screen.
  - The trash icon only detaching, with `exit` the one way to end a shell: shells nobody sees pile up.
  - The terminal's own client starting the next shell (`detach-client -E ‹command›`), which needs no variables copied
    but runs the command through the user's shell, whose quoting rules Aggregor would have to follow.
  - A transient terminal, as session tabs are: a reload would close it, and the user would open it again each time.
  - The panel's + always a plain VS Code terminal, with VS Code's own default terminal left as it was (the earlier
    decision): the terminal VS Code opens by itself, when the panel shows with none, was a plain shell that never
    followed the session in view, beside or instead of the Aggregor terminal.
  - The default profile opening a second Aggregor terminal on + while one is open: typing in one shows in both, and only
    the first follows the session in view.
  - The default profile set in the user's settings, or VS Code's hidden-at-startup setting: the first changes every
    window, and the second leaves the panel with no terminal to show.
  - Finding the terminal by `AGGREGOR_FOLDER_SHELL_PATH` in its env (the earlier decision): a terminal VS Code restores
    after a reload or a quit has no env, so the follow skipped every change of view until Open Terminal launched a
    second terminal.
  - Finding the terminal by asking tmux which open terminal's process is a client on a folder's shell: it survives a
    rename too, but each lookup, the open and the close would all go through tmux.
  - Raising tmux's history limit for everything, which lets each agent's pane grow to twice the memory.
  - Earlier, with VS Code terminals: a new shell on each click; one terminal per session, even for sessions that share a
    folder; only the project's terminal, which left a worktree session's shell in the project's root; the terminal
    button in the … menus too, a second way to the same button; the terminal panel's project button back with Aggregor's
    icon and VS Code's project picker, turned down since the row's button covers it.
