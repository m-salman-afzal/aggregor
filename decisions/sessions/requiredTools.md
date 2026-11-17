# Required tools

## Missing tmux and gh install with one command, through the system's package manager

- **Problem:** a session needs tmux 3.2 or newer, and a pull request on a row needs the GitHub CLI (gh). A user without
  them had to find each tool's install page and install it by hand, one at a time, and heard about gh only once a
  worktree session's lookup failed.
- **Decision:** when the window starts, Aggregor checks both. If any is missing, or tmux is too old, one information
  notification names each and what it is for, with the one command that installs them all from the first package manager
  on `PATH` (`brew install tmux gh`, `sudo apt-get install -y tmux gh`, `dnf`, `pacman` and `apk` with gh as
  `github-cli`, `zypper`); its **Install** runs that command in a terminal, where sudo asks for the password. A start
  that fails for want of tmux offers the same **Install**. With no known package manager, the notice has a button per
  missing tool for its install page. Aggregor never ships or downloads either tool: both come from `PATH`, installed the
  way the user installs everything else, and updated with it. M5 still bundles tmux in the release VSIXs; until then,
  and for a local build after, this is how tmux arrives.
- **Solution:** `RequiredToolsService` checks tmux with `ITmuxInfraService.checkTmuxVersion` and gh with
  `IShellCommandInfraService.listInstalledCommands`, and picks the package manager the same way; `TOOL_INSTALL_COMMANDS`
  in `requiredTools.constant.ts` holds each one's install prefix and package names. The command runs in the **Aggregor
  Setup** terminal (`ITerminalInfraService.openSetupTerminal`) through `sh -c` and waits for Enter so its output stays
  readable; `gh auth login` runs there too. Its close checks again, and notifies again while something is still missing,
  and looks every pull request up again. `RequiredToolsNoticesView` shows the notice. A distribution whose tmux package
  is older than 3.2, such as Debian 11's 3.1c, still leaves tmux too old after the install.
- **Alternatives considered:**
  - A notice per tool, each with its own install, as gh had: two prompts and two sudo passwords for one setup.
  - Downloading gh's release for the platform into the Aggregor folder, checked against its checksums: a gh Aggregor
    ships is one the user never installed or updates.
  - Only the install page, as tmux had: it leaves the user to find the command.
  - Installing through `pkexec` without a terminal: it is missing in WSL and over SSH, while a terminal's sudo works in
    both.
  - A banner in the Sessions webview instead of a notification: the notification shows even while the view is closed.
