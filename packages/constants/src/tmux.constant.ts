export const TMUX = {
  COMMAND: "tmux",
  // Read instead of ~/.tmux.conf when the server starts, and again when a window starts.
  CONFIG_FILE: "assets/tmux.conf",
  INSTALL_PAGE: "https://github.com/tmux/tmux/wiki/Installing",
  // The oldest tmux tmux.conf works with: extended-keys and terminal-features arrived in 3.2.
  MINIMUM_VERSION: {MAJOR: 3, MINOR: 2},
  // Aggregor's own server, apart from the user's tmux; a test's Aggregor folder gets one of its own.
  SOCKET_FILE_NAME: "tmux.sock",
  // What `tmux -V` prints: "tmux 3.8", "tmux 3.3a" or "tmux next-3.6".
  VERSION_NUMBER_PATTERN: /(?<major>\d+)\.(?<minor>\d+)/u,
  VERSION_PREFIX: "tmux"
} as const;

export const AGENT_START_WAIT = {
  POLL_INTERVAL_MS: 50,
  TIMEOUT_MS: 5000
} as const;

export const TMUX_LABELS = {
  INSTALL: "Install tmux"
} as const;

export const TMUX_ERRORS = {
  NOT_INSTALLED: "Aggregor runs every session in tmux 3.2 or newer, which isn't installed.",
  TOO_OLD: (foundVersion: string) =>
    `Aggregor runs every session in tmux 3.2 or newer; this machine has ${foundVersion}.`
} as const;
