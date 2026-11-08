export const EXTENSION_VERSIONS = {
  git: 1
} as const;

export const APP_NAME = "Aggregor App";

export const SETTINGS_SECTION = "aggregorApp";

// Grouped by where each command's button lives.
export const COMMANDS = {
  PROJECT_ROW: {
    NEW_SESSION: "aggregorApp.newSessionInChosenProject",
    REMOVE: "aggregorApp.removeProject"
  },
  SCM_TITLE: {
    GENERATE_COMMIT_MESSAGE: "aggregorApp.generateCommitMessage"
  },
  SESSION_ROW: {
    OPEN: "aggregorApp.openSession",
    REMOVE: "aggregorApp.removeSession",
    RENAME: "aggregorApp.renameSession"
  },
  // The Terminal panel's title bar, next to its + button.
  TERMINAL_TITLE: {
    NEW_PROJECT_TERMINAL: "aggregorApp.newProjectTerminal"
  },
  // The Sessions view's title bar (the manifest's view/title).
  VIEW_TITLE: {
    ADD_PROJECT: "aggregorApp.addProject",
    NEW_SESSION: "aggregorApp.newSessionAskingForProject"
  }
} as const;

export const CONTEXT_KEYS = {
  IS_GENERATING_COMMIT_MESSAGE: "aggregorApp.isGeneratingCommitMessage"
} as const;

// A workspace folder is a "project"; only an "addedProject" can be removed from the sidebar.
export const CONTEXT_VALUES = {
  ADDED_PROJECT: "addedProject",
  PROJECT: "project",
  SESSION: "session"
} as const;

// Any folder can be a project, git or not, so the icon is a plain root folder.
export const PROJECT_ICON = "root-folder";

export const MODEL_ICONS = {
  CLAUDE: "assets/models/claude.svg"
} as const;

// Runs each session's agent and records its status in the database; release VSIXs carry the one for their platform.
export const PTY_BINARY = "bin/aggregor-pty";

// Every session terminal carries its session id, so a restarted extension host can tell which tab is whose.
export const SESSION_ID_ENV = "AGGREGOR_SESSION_ID";

export const DATA_DIRECTORY_ENV = "AGGREGOR_DATA_DIR";

// How often a window checks the database for other connections' writes, such as aggregor-pty's statuses.
export const DATABASE_POLL_INTERVAL = "250 millis";

// drizzle-kit writes one folder per migration here (apps/extension/drizzle.config.ts).
export const MIGRATIONS_FOLDER = "assets/migrations";

// Each Sessions row gets a URI in this scheme so a FileDecorationProvider can draw its status badge.
export const SESSION_URI_SCHEME = "aggregor-session";

// The badge at the end of a session row; an idle session has none. Working steps through its frames, one per
// SPINNER_INTERVAL_MS. Colors are theme color ids, and VS Code tints the row's label with them too.
export const STATUS_BADGES = {
  blocked: {color: "charts.yellow", frames: ["●"]},
  done: {color: "charts.green", frames: ["✓"]},
  error: {color: "errorForeground", frames: ["✕"]},
  exited: {color: "disabledForeground", frames: ["○"]},
  working: {color: "charts.blue", frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]}
} as const;

export const SPINNER_INTERVAL_MS = 120;

export const VIEWS = {
  SESSIONS: "aggregorApp.sessions"
} as const;
