export const TMUX = {
  COMMAND: "tmux",
  CONFIG_FILE: "assets/tmux.conf",
  // The oldest tmux tmux.conf works with: extended-keys and terminal-features arrived in 3.2.
  MINIMUM_VERSION: {MAJOR: 3, MINOR: 2},
  SETUP_SHELL: "sh",
  SOCKET_FILE_NAME: "tmux.sock",
  // What `tmux -V` prints: "tmux 3.8", "tmux 3.3a" or "tmux next-3.6".
  VERSION_NUMBER_PATTERN: /(?<major>\d+)\.(?<minor>\d+)/u,
  VERSION_PREFIX: "tmux"
} as const;

// --scope runs the command in place, in a cgroup of its own, so an out-of-memory kill takes it alone, never VS Code.
export const SYSTEMD_SCOPE = {
  COMMAND: "systemd-run",
  MEMORY_LIMIT_PROPERTY: "MemoryMax",
  OPTIONS: ["--user", "--scope", "--quiet", "--collect"],
  PROBE_COMMAND: "true"
} as const;

export const AGENT_START_WAIT = {
  POLL_INTERVAL_MS: 50,
  TIMEOUT_MS: 5000
} as const;

export const FOLDER_SHELL = {
  // tmux before 3.7 sizes a pane's history as the pane is made, so there a shell keeps tmux.conf's limit.
  HISTORY_LINES: "100000",
  START_SCRIPT: 'unset TMUX TMUX_PANE; exec "$@" "$SHELL" -l',
  // tmux.conf's status line shows this option of the shell's tmux session.
  STATUS_LABEL_OPTION: "@aggregor_folder_label"
} as const;

// A terminal's tmux client attaches a moment after the terminal opens.
export const TMUX_CLIENT_WAIT = {
  POLL_INTERVAL_MS: 50,
  TIMEOUT_MS: 1000
} as const;

export const TMUX_ERRORS = {
  NOT_INSTALLED: "Aggregor runs every session in tmux 3.2 or newer, which isn't installed.",
  TOO_OLD: (foundVersion: string) =>
    `Aggregor runs every session in tmux 3.2 or newer; this machine has ${foundVersion}.`
} as const;
