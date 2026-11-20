export const GITHUB_CLI_COMMANDS = {
  LINK_SESSION_PULL_REQUEST: "aggregorApp.linkSessionPullRequest",
  OPEN_SESSION_PULL_REQUEST: "aggregorApp.openSessionPullRequest",
  SIGN_IN: "aggregorApp.signInToGitHubCli",
  UNLINK_SESSION_PULL_REQUEST: "aggregorApp.unlinkSessionPullRequest"
} as const;

export const GITHUB_CLI = {
  COMMAND: "gh",
  LISTED_PULL_REQUEST_FIELDS: "number,state,isDraft,title,headRefName",
  LISTED_PULL_REQUEST_LIMIT: "100",
  LOOKUP_CONCURRENCY: 4,
  // gh waits on a locked keyring or a stuck network without end; its lookup gives up and frees its slot.
  LOOKUP_TIMEOUT: "15 seconds",
  PULL_REQUEST_FIELDS: "number,url,state,isDraft,title",
  REFRESH_INTERVAL_MS: 30_000,
  SIGN_IN_COMMAND_LINE: "gh auth login",
  SIGNED_OUT_EXIT_CODE: 4
} as const;

export const PULL_REQUEST_LIST_PROBLEMS = {
  FAILED: "failed",
  SIGNED_OUT: "signedOut"
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
  LINK: "Link",
  LINK_PULL_REQUEST: (displayName: string) => `Link a pull request to "${displayName}"`,
  LISTING: "Listing the repository's pull requests…",
  NONE_LISTED: "gh found no pull requests in this repository.",
  PULL_REQUEST_OPTION: (pullRequestNumber: number, pullRequestTitle: string) =>
    `#${pullRequestNumber} ${pullRequestTitle}`,
  PULL_REQUEST_SECTION: "Pull request",
  SIGN_IN: "Sign In"
} as const;

export const PULL_REQUEST_LIST_NOTICES = {
  failed: "gh couldn't list this repository's pull requests: it isn't installed, or the project has no GitHub remote.",
  signedOut: "gh isn't signed in. Run `gh auth login`, then try again."
} as const;

export const GITHUB_CLI_NOTICES = {
  SIGNED_OUT:
    "Aggregor shows each session's pull request with the GitHub CLI (gh), which isn't signed in. Sign In runs `gh auth login` in a terminal."
} as const;

export const GITHUB_CLI_ERRORS = {
  PULL_REQUEST_NOT_FOUND: "This session's branch has no pull request."
} as const;
