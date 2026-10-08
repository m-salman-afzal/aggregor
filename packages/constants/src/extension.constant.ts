export const EXTENSION_VERSIONS = {
  git: 1
} as const;

export const APP_NAME = "Aggregor App";

export const SETTINGS_SECTION = "aggregorApp";

export const COMMANDS = {
  FOCUS_SESSION: "aggregorApp.focusSession",
  GENERATE_COMMIT_MESSAGE: "aggregorApp.generateCommitMessage",
  NEW_SESSION: "aggregorApp.newSession"
} as const;

export const CONTEXT_KEYS = {
  IS_GENERATING_COMMIT_MESSAGE: "aggregorApp.isGeneratingCommitMessage"
} as const;

export const PRODUCT_ICONS = {
  DARK: "assets/aggregorDarkIcon.svg",
  LIGHT: "assets/aggregorLightIcon.svg"
} as const;

export const VIEWS = {
  SESSIONS: "aggregorApp.sessions"
} as const;
