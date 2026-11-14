# Worktrees

Where a session works: its project's root, or a git worktree of its own.

## New Session asks for the agent and the working tree in one dialog

- **Problem:** a session can work in its project's root, in a new worktree, or in a worktree that already exists, and
  New Session already asked for the project and the agent one dialog at a time.
- **Decision:** one dialog shows every choice left to make at once, each with its default chosen, and Start sends one
  `newSession {projectPath, agentId, workingTree}` request. The project shows when New Session came from the list's
  button and there is more than one; the agent when more than one is installed, unless `aggregorApp.skipAgentPicker`
  skips it for a default; the working tree in a git project: Project root, New worktree, and each of the repository's
  worktrees no session works in. With nothing to choose, as in a folder outside git with one agent, the session starts
  at once. The project's `newSessionWorkingTree` setting picks the default.
- **Solution:** `ProjectSessionsDto.worktrees` carries a git project's linked worktrees, read on each draw of the
  Sessions list; a project outside git has none. A worktree made outside Aggregor shows from the next full draw (a
  project change, or the view shown again). The agents' star saves the default and picks that agent.
- **Alternatives considered:** a step per choice with Back; New Session in Worktree as its own menu item; a third step
  after the agent.

## A new worktree is named after its session, made from the project's current commit

- **Problem:** a worktree needs a folder and a branch, and the project its own place for them.
- **Decision:** the worktree is created when the session is, from the project's `HEAD`, named after the session's
  default name: "jsTester #3" works in `jstester-3`, on `aggregor/jstester-3`; a name taken as a branch or a folder gets
  `-2`, `-3` and so on. It goes in `~/.aggregor/worktrees/<project>-<6 characters of its id>/`, or the project's
  worktree folder setting. The project's files to copy (its `.worktreeinclude`, else its settings' patterns, `.env*` by
  default) are copied in, matched as .gitignore matches them, and its setup script runs in the session's tab before the
  agent, on the first start only; the agent starts whether or not the script succeeds. The session stores
  `worktreePath`; its tab, tmux session and agent work there (`SessionEntity.workingFolderPath`), and the window shows
  the worktree while the session is in front, so Explorer, search and Source Control show the session's own changes. A
  worktree shown is not listed as a project.
- **Solution:** `IWorktreeInfraService` (`infrastructure/services/git/`) runs `git worktree` on the command line.
  Renaming the branch from the session's title, cleanup and the branch on the row come with the next steps.
- **Alternatives considered:** the Git extension's `createWorktree` and `state.worktrees`, agreed first: its API reaches
  only repositories open in Source Control, so every project would have to be opened there to list or create its
  worktrees. Worktrees beside the repository or inside it (`.worktrees/`, which needs a `.gitignore` entry). The
  repository's default branch as the base.
