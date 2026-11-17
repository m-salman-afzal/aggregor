export const GITHUB_CLI_COMMANDS = {
  OPEN_SESSION_PULL_REQUEST: "aggregorApp.openSessionPullRequest",
  SIGN_IN: "aggregorApp.signInToGitHubCli"
} as const;

export const GITHUB_CLI = {
  COMMAND: "gh",
  LOOKUP_CONCURRENCY: 4,
  // gh waits on a locked keyring or a stuck network without end; its lookup gives up and frees its slot.
  LOOKUP_TIMEOUT: "15 seconds",
  PULL_REQUEST_FIELDS: "number,url,state,isDraft,title",
  // A focus within this long of the last refresh looks nothing up again.
  REFRESH_INTERVAL_MS: 30_000,
  SIGN_IN_COMMAND_LINE: "gh auth login",
  // gh's exit code when no account is signed in.
  SIGNED_OUT_EXIT_CODE: 4
} as const;

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
  SIGN_IN: "Sign In"
} as const;

export const GITHUB_CLI_NOTICES = {
  SIGNED_OUT:
    "Aggregor shows each session's pull request with the GitHub CLI (gh), which isn't signed in. Sign In runs `gh auth login` in a terminal."
} as const;

export const GITHUB_CLI_ERRORS = {
  PULL_REQUEST_NOT_FOUND: "This session's branch has no pull request."
} as const;
