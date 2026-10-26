export const EXTENSION_VERSIONS = {
  git: 1
} as const;

export const APP_NAME = "Aggregor App";

export const SETTINGS_SECTION = "aggregorApp";

export const COMMANDS = {
  ADD_REPO: "aggregorApp.addRepo",
  GENERATE_COMMIT_MESSAGE: "aggregorApp.generateCommitMessage",
  NEW_SESSION: "aggregorApp.newSession",
  OPEN_SESSION: "aggregorApp.openSession",
  REMOVE_REPO: "aggregorApp.removeRepo",
  REMOVE_SESSION: "aggregorApp.removeSession"
} as const;

export const CONTEXT_KEYS = {
  IS_GENERATING_COMMIT_MESSAGE: "aggregorApp.isGeneratingCommitMessage"
} as const;

// A workspace folder is a "repo"; only an "addedRepo" can be removed from the sidebar.
export const CONTEXT_VALUES = {
  ADDED_REPO: "addedRepo",
  REPO: "repo",
  SESSION: "session"
} as const;

export const REPO_ICON = "repo";

export const MODEL_ICONS = {
  CLAUDE: "assets/models/claude.svg"
} as const;

// Claude settings passed with --settings: hooks that write the session's status to the file named in STATUS_ENV.
export const HOOKS_FILE = "assets/hooks.json";

export const STATUS_ENV = "AGGREGOR_STATUS_FILE";

// Each Sessions row gets a URI in this scheme so a FileDecorationProvider can draw its status badge.
export const SESSION_URI_SCHEME = "aggregor-session";

// The badge at the end of a session row; an idle session the user has seen has none. Running steps through its frames,
// one per SPINNER_INTERVAL_MS. Colors are theme color ids, and VS Code tints the row's label with them too.
export const STATUS_BADGES = {
  exited: {color: "disabledForeground", frames: ["○"]},
  "needs-input": {color: "charts.yellow", frames: ["●"]},
  running: {color: "charts.blue", frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]},
  unread: {color: "charts.green", frames: ["●"]}
} as const;

export const SPINNER_INTERVAL_MS = 120;

export const STORAGE_KEYS = {
  REPOS: "repos",
  SESSIONS: "sessions"
} as const;

export const VIEWS = {
  SESSIONS: "aggregorApp.sessions"
} as const;
