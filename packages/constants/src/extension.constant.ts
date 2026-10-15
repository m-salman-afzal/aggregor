export const EXTENSION_VERSIONS = {
  git: 1
} as const;

export const APP_NAME = "Aggregor App";

export const SETTINGS_SECTION = "aggregorApp";

export const COMMANDS = {
  GENERATE_COMMIT_MESSAGE: "aggregorApp.generateCommitMessage",
  NEW_SESSION: "aggregorApp.newSession",
  OPEN_SESSION: "aggregorApp.openSession",
  REMOVE_SESSION: "aggregorApp.removeSession"
} as const;

export const CONTEXT_KEYS = {
  IS_GENERATING_COMMIT_MESSAGE: "aggregorApp.isGeneratingCommitMessage"
} as const;

export const CONTEXT_VALUES = {
  SESSION: "session"
} as const;

export const MODEL_ICONS = {
  CLAUDE: "assets/models/claude.svg"
} as const;

export const STORAGE_KEYS = {
  SESSIONS: "sessions"
} as const;

export const VIEWS = {
  SESSIONS: "aggregorApp.sessions"
} as const;
