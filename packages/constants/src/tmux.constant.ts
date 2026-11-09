// Every session's agent runs in a tmux session on Aggregor's own tmux server, named by the session's id.

export const TMUX_COMMAND = "tmux";

// Read instead of ~/.tmux.conf when the server starts, and again when a window starts.
export const TMUX_CONFIG_FILE = "assets/tmux.conf";

// The oldest tmux tmux.conf works with: extended-keys and terminal-features arrived in 3.2.
export const MINIMUM_TMUX_VERSION = {MAJOR: 3, MINOR: 2} as const;

export const TMUX_INSTALL_PAGE = "https://github.com/tmux/tmux/wiki/Installing";

// How long a session's tab may take to start its agent's tmux session, and how often tmux's list is read meanwhile.
export const AGENT_START_TIMEOUT_MS = 5000;
export const AGENT_START_POLL_INTERVAL_MS = 50;

export const TMUX_LABELS = {
  INSTALL: "Install tmux"
} as const;

export const TMUX_ERRORS = {
  UNAVAILABLE: (foundVersion: string | undefined) =>
    foundVersion === undefined
      ? "Aggregor runs every session in tmux 3.2 or newer, which isn't installed."
      : `Aggregor runs every session in tmux 3.2 or newer; this machine has ${foundVersion}.`
} as const;
