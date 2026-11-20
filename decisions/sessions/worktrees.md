# Worktrees

Where a session works: its project's root, or a git worktree of its own.

## New Session asks for the agent and the working tree in one dialog

- **Problem:** a session can work in its project's root, in a new worktree, or in a worktree that already exists, and
  New Session already asked for the project and the agent one dialog at a time.
- **Decision:** one dialog shows every choice left to make at once, each with its default chosen, and Start sends one
  `createSession {projectPath, agentId, workingTree}` request. The project shows when New Session came from the list's
  button and there is more than one; the agent when more than one is installed, unless `aggregorApp.skipAgentPicker`
  skips it for a default; the working tree in a git project: Project root, New worktree, and each of the repository's
  worktrees no session works in; and with New worktree chosen, the branch it starts from (see "A new worktree is named
  after its session"). The project, the agent and the branch are each a dropdown showing the one chosen, with a search
  box over its list, so the dialog stays short; the working tree stays a list of rows. With nothing to choose, as in a
  folder outside git with one agent, the session starts at once. The project's `newSessionWorkingTree` setting picks the
  default.
- **Solution:** `ProjectSessionsDto.worktrees` carries a git project's linked worktrees, read on each draw of the
  Sessions list; a project outside git has none. A worktree made outside Aggregor shows from the next full draw (a
  project change, or the view shown again). The dropdowns are shadcn's Combobox on Base UI (`OptionPicker`). The star on
  an agent in the agent dropdown saves the default and picks that agent, without closing the list. Starting unfolds the
  Sessions list and the session's project in it (`revealSessionsProject`), so the new row shows.
- **Alternatives considered:** a step per choice with Back; New Session in Worktree as its own menu item; a third step
  after the agent; every choice as a list of rows (the first version), which grew taller than the view with five agents;
  shadcn's Select for the agents beside the Combobox for branches, two components for one job; the menu dropdown already
  in `@pkg/ui`, which has no search.

## Change Working Tree and Unlink Worktree move a session to another working tree, and restart its agent there

- **Problem:** a session's working tree was fixed when it started, so a session started in the project root couldn't be
  linked to the worktree it or its agent went on to work in, and one in a worktree couldn't move to another or back.
- **Decision:** Change Working Tree…, in an ongoing session's … menu in a git project, opens New Session's working tree
  choices (Project root, New worktree with its From, and each worktree no other session works in), with the session's
  own marked Current and chosen. Move sends `changeSessionWorkingTree {sessionId, workingTree}`, the same working tree
  choice New Session sends. A running agent is stopped and started again in the new folder with its resume arguments, so
  its conversation carries on there (Claude Code's `--resume <id>` finds a conversation from any folder, and Codex's
  `resume -C .` stays in the new one, see [terminals.md](terminals.md)); the dialog asks first only when that cuts a
  turn short, as Stop does. A stopped agent only has its row changed, unless a new worktree's setup script has to run,
  which starts the agent after it, as New Session does. The worktree left behind is kept: one Aggregor made becomes a
  leftover for the project's cleanup. Unlink Worktree, in a worktree session's menu, is the same move to the project
  root in one click, asking first only mid-turn.
- **Solution:** `SessionService.changeSessionWorkingTree` reuses `prepareSessionWorkingTree`, so a new worktree is named
  after the session, from `SessionWorktreeDraft` (the project, its name and the session's name), which New Session's
  draft extends. It writes `worktreePath` and `baseBranchName` (none for an existing worktree or the root), and choosing
  the working tree the session already has changes nothing. It touches the project's row, so the change feed redraws the
  project and its leftovers dot. The terminal service drops a closed session tab from its map when it disposes it, not
  when VS Code reports it closed, since the restart opens the session's next tab at once. The working tree choice is
  `WorkingTreeChoiceDto`, tagged with `WORKING_TREE_CHOICE_TAGS`. The webview's `WorkingTreeInput` draws New Session's
  `makeOptionGroups` with no project or agent group, given the `movedSession`; `unlinkSessionWorktree` is
  `changeSessionWorkingTree` to the project root.
- **Alternatives considered:** changing the row and leaving a running agent where it is, which would show the window,
  Source Control and the row's counts on a folder the agent isn't working in; linking from the agent's own working
  folder (`/proc/‹pid›/cwd`), turned down for the pull request row too; removing the worktree left behind, which can
  hold work.

## A new worktree is named after its session, made from the project's current commit or a chosen branch

- **Problem:** a worktree needs a folder, a branch and a commit to start from, and the project its own place for them.
- **Decision:** the worktree is created when the session is, from the project's `HEAD` unless New Session's **From**
  names a branch. From's dropdown has a **Local** tab (Current commit, with the project's checked-out branch shown under
  it, then each local branch) and a **Remote** tab (origin's branches, labelled `origin/<name>`), so which side a branch
  is on shows at a glance, and the chosen one keeps its `origin/` in the closed dropdown; search filters the open tab,
  and the dropdown opens on the tab holding the chosen branch. The branches show at once as of the last fetch, so the
  dialog never waits on the network; `git fetch --prune origin` runs behind them, a spinner on the Remote tab says so,
  and the list is drawn again when it ends. A fetch that fails or passes 30 s (offline, signed out, a slow origin) only
  leaves the list as it was; git is never left waiting on a credential prompt. Local branches are not fast-forwarded:
  the Remote tab is where the latest is. The worktree gets its own branch either way, starting at the chosen one, and
  From always opens on Current commit. It is named after the session's default name: "jsTester #3" works in
  `jstester-3`, on `aggregor/jstester-3`; a name taken as a branch or a folder gets `-2`, `-3` and so on. It goes in
  `~/.aggregor/worktrees/<project>-<6 characters of its id>/`, or the project's worktree folder setting. The project's
  files to copy (its `.worktreeinclude`, else its settings' patterns, `.env*` by default) are copied in, matched as
  .gitignore matches them, and its setup script runs in the session's tab before the agent, on the first start only; the
  agent starts whether or not the script succeeds. The session stores `worktreePath`; its tab, tmux session and agent
  work there (`SessionEntity.workingFolderPath`), and the window shows the worktree while the session is in front, so
  Explorer, search and Source Control show the session's own changes. A worktree shown is not listed as a project.
- **Solution:** `IWorktreeInfraService` (`infrastructure/services/git/`) runs `git worktree` on the command line, with
  `GIT_TERMINAL_PROMPT=0`; `createWorktree` takes the start point, `listBranchNames` reads `refs/heads` and
  `refs/remotes/origin` with `git for-each-ref` into `localBranchNames` and `remoteBranchNames`, leaving out
  `origin/HEAD`, and `fetchRemote` runs the fetch. The webview asks for the branches with `LIST_BRANCHES` when New
  worktree is picked, and again when the project changes under it; `WorktreeService.listProjectBranches` returns a
  stream of two `ProjectBranchesDto`s, the refs as they are with `isFetchingRemote` and the refs after the fetch without
  it, and the view posts each as `BRANCHES_DRAWN`. Until the first comes back only Current commit is offered. The tabs
  are shadcn's on Base UI (`@pkg/ui`'s `tabs.tsx`), above the combobox's list in `OptionPickerPopup`.

- **Alternatives considered:** the Git extension's `createWorktree` and `state.worktrees`, agreed first: its API reaches
  only repositories open in Source Control, so every project would have to be opened there to list or create its
  worktrees. Worktrees beside the repository or inside it (`.worktrees/`, which needs a `.gitignore` entry). The
  repository's default branch as the base. Fetching before listing the branches, which waits on the network; fetching
  only when a remote branch is chosen, which still starts from stale lists. One list with local and remote branches
  mixed, agreed first: `dev` and `origin/dev` read alike at a glance. Remote names without `origin/`, which hides the
  side once the dropdown closes. Two plain buttons instead of a tab component. Fast-forwarding local branches after the
  fetch, which writes refs the user may have checked out. No fetching indicator, the list just changing under the user.
  The prune's 10 s timeout, which a big fetch outlasts and is then killed every time. Reading the branches on every
  project draw, a git process each time. A project setting for the default start point.

## A worktree's branch takes the session's first title, and its menu renames it

- **Problem:** a new worktree's branch is named after the session's default name (`aggregor/jstester-8`), which says
  nothing about the work, and the user wants to rename it or have it follow the title.
- **Decision:** when the agent gives the session its first title, the title sync renames the branch to
  `aggregor/<title>` (lowercase, words joined by `-`, at most 50 characters cut at a word, numbered when taken), but
  only while it still has its first name (`aggregor/<its worktree folder>`) and was never pushed (no upstream), so it
  happens once and never to a linked worktree's branch or one renamed by hand. The folder keeps its name, since the
  agent works in it. Rename Branch, in a worktree session's menu, renames whatever branch the worktree has checked out
  to the name typed; git refuses a bad or taken name and its message is shown; a pushed branch may be renamed too. The
  row's second line ends with the branch, under a git-branch icon, or a short commit hash when the worktree is detached.
  Rename Session leaves the branch alone.
- **Solution:** the branch name is never stored: each draw of a row reads the worktree's `.git` file and the `HEAD` it
  points to, two small reads and no git process, so a branch the agent switches to shows on its next redraw. The title
  sync renames the branch before it saves the name, so one write redraws both. Rename Branch writes nothing of the
  session's, so it touches the row (`updatedAt`), and the change feed redraws it. `IWorktreeInfraService` gained
  `readBranchName`, `hasUpstream`, `findFreeBranchName` and `renameBranch` (`git branch -m`). Explainer:
  [Aggregor Titles and Branches](https://claude.ai/artifact/25cQsgG1j3EHJRmCAW2qpZ), a 30-second film of a title's way
  from the agent's tab through `aggregor-pty`, SQLite and the change feed to the title sync, the branch and the row, and
  of a rename by hand.
- **Alternatives considered:** storing the branch on the session's row, which can disagree with git once the agent or
  the user changes it (T3 Code's known bug); a stream of renamed branches from the worktree service in place of the
  touch, more machinery for the same redraw; renaming the folder too, which moves the agent's working folder from under
  it; a temporary hashed name renamed by an LLM in the background (T3 Code); telling the agent to rename its branch
  (Conductor).

## Remove deletes a session's worktree, and each project's cleanup lists what is left over

- **Problem:** worktrees and `aggregor/*` branches pile up once their sessions are done, and the user wants to clear the
  merged ones without losing work.
- **Decision:** Archive keeps the worktree, since the agent may still be finishing its turn. Remove deletes it first,
  then forgets the session and stops its agent; git refuses a worktree with changes ("commit or discard them in Source
  Control, then remove it"), nothing is removed and nothing is forced. The branch is kept. Only a worktree Aggregor made
  (under its worktrees folder or the project's worktree folder setting) that no other session works in is deleted; a
  linked worktree is only forgotten. Leftovers are the worktrees Aggregor made that no ongoing session works in and no
  archived session's agent still runs in, and the `aggregor/*` branches with no worktree or a leftover one. A red dot
  shows on the project's row while it has any, and its broom button, beside New Session, opens a dialog listing them: it
  prunes origin first (`gdrb`'s step, at most 10 seconds), then counts a branch as merged when its upstream is gone or
  its last commit is in the base branch (origin's default branch, else the project's checked-out one). Merged rows start
  ticked, never-pushed and unmerged ones are listed but not ticked, and a worktree with changes, with its branch, can't
  be ticked. Delete removes the ticked worktrees first, forgetting their archived sessions, then deletes the ticked
  branches with `git branch -D`, since a squash-merged branch never looks merged to git; anything kept is named in one
  message. Deleting a worktree leaves nothing of it behind: its project's folder under Aggregor's worktrees folder goes
  with the project's last worktree, and a window showing the worktree shows its project instead.
- **Solution:** `worktree.service.ts` holds the leftover rules; `IWorktreeInfraService` gained `hasChanges`,
  `removeWorktree`, `isMadeByAggregor`, `listAggregorBranches` (`git for-each-ref` with each branch's upstream track and
  worktree), `pruneRemote`, `findBaseBranch`, `isBranchMerged` and `deleteBranch`. The dot reads local refs only, on
  each project draw, which now sends the project's whole row (`PROJECT_DRAWN`) rather than its sessions; an archived
  worktree session's agent starting or stopping redraws its project, so the dot follows it. The dialog asks the host
  with a `LIST_LEFTOVERS` message and fills in when `LEFTOVERS_DRAWN` comes back. Cleanup changes no session row when it
  only deletes branches, so it touches the project row and the change feed redraws the list. `removeWorktree` deletes
  the project's folder once it is empty, and only under Aggregor's own worktrees folder: a project's worktree folder
  setting names the user's folder, which stays. Effect's `FileSystem` has no `rmdir`, so it reads the folder and then
  removes it, and a worktree added between the two would go too. `showProjectInPlaceOfWorktree` runs after git has
  deleted the worktree and before its session is forgotten: while the session is stored its worktree is no project, and
  once it is forgotten the window's folder would be listed as a project of its own (`listProjects`), which the next
  switch saves (`keepWorkspaceFoldersListed`). The settings sync skips a folder that is gone (see
  `projects/workspace.md`), so the switch away writes nothing into it.
- **Alternatives considered:** removing the worktree on archive, which pulls the folder from under an agent still at
  work; forcing removal of a worktree with changes; deleting the branch on Remove; a merge check against the base branch
  only, which misses squash merges, and only `gdrb`'s gone-upstream check, which misses local merges; pruning on every
  draw, which waits on the network; a cleanup item in the project's … menu for every git project, shown even with
  nothing to clean. Leaving the project's empty folder behind, which piled up one per project. Showing the project
  before deleting the worktree, agreed first: the switch away writes the workspace's settings edits into the worktree,
  which git then refuses to delete as changed, and a refusal leaves the window away from the worktree whose changes it
  asks the user to commit or discard. Taking the folder out of the window and showing no project.

## New Session points to trusting the worktrees folder once

- **Problem:** VS Code asks to trust each new worktree: the window shows it as a workspace folder, and it sits outside
  every folder the user trusted, while a project sits inside one. The dialog trusts only that worktree, so the next one
  asks again. VS Code trusts a folder with everything under it, but gives extensions no way to trust one.
- **Decision:** worktrees stay in `~/.aggregor/worktrees` (or the project's worktree folder setting), and the user
  trusts that folder once. While New worktree is chosen in New Session and VS Code's workspace trust is on, a hint names
  the folder; **Trust Worktrees Folder…** copies its path and opens Manage Workspace Trust, where Add Folder takes it,
  and **Don't show again** hides the hint.
- **Solution:** `IWorktreeInfraService.findWorktreesRootPath` gives the folder: the project's setting, home-expanded,
  else `<Aggregor folder>/worktrees`, which holds every project's worktrees. `ProjectSessionsDto.worktreesRootPath`
  carries it on a git project's row, and `AGENTS_DRAWN` carries `security.workspace.trust.enabled` beside
  `skipAgentPicker`, the dialog's other setting. The webview copies the path itself, before running
  `workbench.trust.manage` through `RUN_COMMAND`, since the copy fails once the page loses focus; the hidden hint is
  kept in the webview's saved state.
- **Alternatives considered:** worktrees inside the project (`<project>/.aggregor/worktrees`, Claude Code's layout),
  trusted with it, which puts extra checkouts in front of every tool that walks the project folder; worktrees inside the
  anchor folder, trusted in every anchored window, which fails in a window without an anchor; writing VS Code's trust
  store, which VS Code owns and keeps in memory; a banner after the session starts, by when the dialog has asked.

## A worktree session's row counts what its branch changed

- **Problem:** a worktree session's row says nothing about how much its agent has changed, and the diff with per-hunk
  staging the roadmap planned is more than the row needs.
- **Decision:** the row's second line shows a diff icon, the number of files changed, and the lines added in green
  stacked over those deleted in red, at 10px, before the branch, so large counts take little of the line's width. They
  count everything the session's branch changed since it split from its base branch: its commits, its uncommitted edits
  and its new files. The base is the branch chosen in New Session's From, or, with Current commit, the branch the
  project had checked out when Aggregor made the worktree, since the worktree starts from that HEAD; it is stored on the
  session as `baseBranchName` (a detached HEAD stores its short hash). A session without one, from before the column or
  in a worktree Aggregor didn't make, counts from the branch the project has checked out now. A new file's lines count
  as added; a binary one, or one over 1 MB, counts as a file only. Nothing shows while nothing changed, and only
  worktree sessions count, since the project root's sessions share one working tree. No file list and no diff open from
  it.
- **Solution:** `IWorktreeInfraService.readDiffStats` runs `git merge-base HEAD <base>`, `git diff --numstat` against
  that commit, and `git ls-files --others --exclude-standard`, reading each new file to count its lines.
  `SessionListItemDto.diffStats` carries the counts, read on each draw of the row, so they follow the agent's turns.
  `createSessionWorktree` reads the project's branch before `git worktree add`; a base branch deleted later leaves the
  row without counts.
- **Alternatives considered:** the added and deleted counts side by side, which took the width the branch needs; the
  cleanup's base, origin's default branch, which counted every unreleased commit on `dev` in a fresh worktree made from
  `dev` (79 files on a session that had changed none); the branch the project has checked out now, with no column, which
  goes wrong once the project switches branch; a list of the changed files with their status (M/A/D/R/U) under the row,
  opening git's diff with per-hunk staging; uncommitted changes only, as Source Control shows them, which drop to
  nothing once the agent commits; a file watcher, when each turn's end already redraws the row.
