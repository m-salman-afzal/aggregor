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

## A worktree's branch takes the session's first title, and its menu renames it

- **Problem:** a new worktree's branch is named after the session's default name (`aggregor/jstester-8`), which says
  nothing about the work, and the user wants to rename it or have it follow the title.
- **Decision:** when the agent gives the session its first title, the title sync renames the branch to
  `aggregor/<title>` (lowercase, words joined by `-`, at most 50 characters cut at a word, numbered when taken), but
  only while it still has its first name (`aggregor/<its worktree folder>`) and was never pushed (no upstream), so it
  happens once and never to a linked worktree's branch or one renamed by hand. The folder keeps its name, since the
  agent works in it. Rename Branch, in a worktree session's menu, renames whatever branch the worktree has checked out
  to the name typed; git refuses a bad or taken name and its message is shown; a pushed branch may be renamed too. The
  row's second line shows the branch after the agent's icon, under a git-branch icon, or a short commit hash when the
  worktree is detached. Rename Session leaves the branch alone.
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
