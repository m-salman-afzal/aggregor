export const GITHUB_CLI_COMMANDS = {
  INSTALL: "aggregorApp.installGitHubCli",
  OPEN_SESSION_PULL_REQUEST: "aggregorApp.openSessionPullRequest",
  SIGN_IN: "aggregorApp.signInToGitHubCli"
} as const;

export const GITHUB_CLI = {
  COMMAND: "gh",
  INSTALL_PAGE: "https://github.com/cli/cli#installation",
  LOOKUP_CONCURRENCY: 4,
  // gh waits on a locked keyring or a stuck network without end; its lookup gives up and frees its slot.
  LOOKUP_TIMEOUT: "15 seconds",
  PULL_REQUEST_FIELDS: "number,url,state,isDraft,title",
  // A focus within this long of the last refresh looks nothing up again.
  REFRESH_INTERVAL_MS: 30_000,
  SIGN_IN_COMMAND_LINE: "gh auth login",
  // gh's exit code when no account is signed in.
  SIGNED_OUT_EXIT_CODE: 4,
  // Keeps the terminal's output on screen until the user has read it; closing it then looks every branch up again.
  TERMINAL_CLOSE_PROMPT: "; printf '\\nPress Enter to close.'; read -r _",
  TERMINAL_NAME: "GitHub CLI",
  TERMINAL_SHELL: "sh"
} as const;

// The first package manager on PATH installs gh, as gh's install guide gives it; sudo asks in the terminal.
export const GITHUB_CLI_INSTALL_COMMANDS = [
  {commandLine: "brew install gh", packageManager: "brew"},
  {commandLine: "sudo apt-get install -y gh", packageManager: "apt-get"},
  {commandLine: "sudo dnf install -y gh", packageManager: "dnf"},
  {commandLine: "sudo pacman -S --noconfirm github-cli", packageManager: "pacman"},
  {commandLine: "sudo zypper install -y gh", packageManager: "zypper"},
  {commandLine: "sudo apk add github-cli", packageManager: "apk"}
] as const;

export const PULL_REQUEST_OPEN_PLACES = {
  BROWSER: "browser",
  VS_CODE: "vscode"
} as const;

// The GitHub Pull Requests extension's own link, since 0.122.0; it takes only github.com pull requests.
export const GITHUB_PULL_REQUESTS_EXTENSION = {
  ID: "GitHub.vscode-pull-request-github",
  OPEN_PULL_REQUEST_PATH: "/open-pull-request-webview",
  PULL_REQUEST_URL_PARAMETER: "uri"
} as const;

export const GITHUB_CLI_LABELS = {
  INSTALL: "Install gh",
  INSTALL_PAGE: "Install Page",
  SIGN_IN: "Sign In"
} as const;

export const GITHUB_CLI_NOTICES = {
  NOT_INSTALLED: (installCommandLine: string) =>
    `Aggregor shows each session's pull request with the GitHub CLI (gh), which isn't installed. Install gh runs \`${installCommandLine}\` in a terminal.`,
  NOT_INSTALLED_WITHOUT_PACKAGE_MANAGER:
    "Aggregor shows each session's pull request with the GitHub CLI (gh), which isn't installed; its install page says how.",
  SIGNED_OUT:
    "Aggregor shows each session's pull request with the GitHub CLI (gh), which isn't signed in. Sign In runs `gh auth login` in a terminal."
} as const;

export const GITHUB_CLI_ERRORS = {
  NO_PACKAGE_MANAGER: "No package manager Aggregor knows is installed, so gh has to be installed by hand.",
  PULL_REQUEST_NOT_FOUND: "This session's branch has no pull request."
} as const;
