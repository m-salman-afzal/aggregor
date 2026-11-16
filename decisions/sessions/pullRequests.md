# Pull requests

A session's pull request on its row, and opening it.

## A worktree session's row shows its branch's pull request, found with gh

- **Problem:** a session's branch was on its row, but its pull request lived only on GitHub, so seeing whether it was
  open, a draft or merged, or opening it, meant leaving VS Code to look it up.
- **Decision:** a worktree session's row shows the pull request whose head is the worktree's checked-out branch, after
  the branch name: a pull request icon and `#123`, coloured by its state (open green, draft grey, merged purple, closed
  red, from the theme's terminal palette), with its title and state in the tooltip. It comes from the GitHub CLI, run in
  the worktree as `gh pr view ‹branch› --json number,url,state,isDraft,title`, so gh's own sign-in, hosts and remotes
  decide which repository it asks, as Orca, Crystal, Superset and Vibe Kanban do. A root session shows none: its
  project's checked-out branch is every root session's. Clicking the number opens the pull request where
  `aggregorApp.openPullRequestIn` says: `browser` (the default), or `vscode`, the GitHub Pull Requests extension's own
  link (`vscode://GitHub.vscode-pull-request-github/open-pull-request-webview?uri=‹url›`, since its 0.122.0), which
  falls back to the browser without the extension. Open Pull Request in the row's … menu does the same from the
  keyboard.
- **Solution:**
  - `IGitHubCliInfraService` (`infrastructure/services/gitHubCli/`) keeps each folder and branch's last answer in
    memory, never in the database, like the diff stats. Reading the list never waits on the network: a branch not looked
    up yet reads as having none and is queued, and a queue in the layer's own fiber looks four up at a time, each given
    up after 15 seconds, since gh can hang on a locked keyring. A changed answer redraws the rows of the sessions in
    that worktree through `pullRequestChangedFolderPaths`.
  - Every branch is looked up again when the window regains focus, at most once in 30 seconds, and a session's branch
    when its turn ends, which `PullRequestService` reads as a new status change to finished or idle.
  - gh's exit code 4 is signed out, a failed start is gh missing, and anything else (no pull request, no GitHub remote,
    no repository) shows nothing, with gh's stderr on the lookup's span.
  - The number is a span inside the row's button: a click whose target is in it runs
    `aggregorApp.openSessionPullRequest` instead of opening the session, since a button can't hold another.
- **Alternatives considered:** VS Code's GitHub sign-in with REST or GraphQL calls of our own (T3 Code's way), which
  needs no gh but asks for the `repo` scope and parses remotes itself; storing the pull request on the session's row,
  which would make GitHub a second writer of what the list shows; linking a worktree to a session from the agent's own
  working folder (`/proc/‹pid›/cwd`, which Claude's EnterWorktree moves), dropped for New Session's own choice of an
  existing worktree; a stored list of linked pull requests with manual link and unlink (T3 Code, Orca); CI checks and
  review state on the row; a timer that looks every branch up every few minutes (Superset, Vibe Kanban); the number as
  its own button over the row, which would have meant drawing the row's button as an overlay.

## A missing or signed-out gh asks once, and installs only through the system's package manager

- **Problem:** without gh, or with gh signed out, no pull request ever shows, and nothing would say why.
- **Decision:** the first lookup that meets either raises an information notification, once per window: gh missing names
  the command that would install it, as gh's install guide gives it for the first package manager on `PATH`
  (`brew install gh`, `sudo apt-get install -y gh`, `dnf`, `pacman`, `zypper`, `apk`), and its **Install gh** button
  runs that command in a terminal, where sudo asks for the password; with no known package manager, **Install Page**
  opens gh's install page. Signed out, **Sign In** runs `gh auth login` in a terminal. Aggregor never ships or downloads
  a gh of its own: gh comes from `PATH`, installed the way the user installs everything else, and updated with it.
- **Solution:** the terminal, named GitHub CLI, runs the command through `sh -c` and waits for Enter so its output stays
  readable; its close looks every branch up again and lets each notice show once more, so a sign-in still missing asks
  again. `GitHubCliNoticesView` shows the notices; `PullRequestService` picks the install command with
  `IShellCommandInfraService.listInstalledCommands`.
- **Alternatives considered:** downloading gh's release for the platform into the Aggregor folder, checked against the
  release's checksums, and using it when gh isn't on `PATH`: turned down, since a gh Aggregor ships is one the user
  never installed or updates; a link to the install page only, as tmux has, which leaves the user to find the command.
