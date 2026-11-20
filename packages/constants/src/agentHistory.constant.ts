export const AGENT_HISTORY_AGENT_IDS = {
  CLAUDE: "claude",
  CODEX: "codex",
  COPILOT: "copilot",
  OPENCODE: "opencode"
} as const;

// Claude Code keeps a conversation per file, in a folder named after its working folder with each symbol as "-".
export const CLAUDE_HISTORY = {
  // A command's or hook's output Claude records as the user's, such as <command-name>, isn't a prompt.
  COMMAND_MARKUP_PREFIX: "<",
  CONFIG_FOLDER_ENV: "CLAUDE_CONFIG_DIR",
  CONVERSATION_FILE_EXTENSION: ".jsonl",
  DEFAULT_CONFIG_FOLDER: ".claude",
  FOLDER_NAME_SYMBOL: /[^a-zA-Z0-9]/gu,
  FOLDER_NAME_SYMBOL_REPLACEMENT: "-",
  // A title line comes again every few turns, so the last 64 KB holds the latest; the first prompt sits near the top.
  HEAD_BYTES: 65_536,
  PROJECTS_FOLDER: "projects",
  READ_CONCURRENCY: 8,
  TAIL_BYTES: 65_536
} as const;

export const CLAUDE_HISTORY_LINE_TYPES = {
  AI_TITLE: "ai-title",
  CUSTOM_TITLE: "custom-title",
  USER: "user"
} as const;

export const CODEX_HISTORY = {
  DATABASE_FILE_NAME: "state_5.sqlite",
  DEFAULT_HOME_FOLDER: ".codex",
  HOME_ENV: "CODEX_HOME",
  SQLITE_HOME_ENV: "CODEX_SQLITE_HOME"
} as const;

// OpenCode stores ids with their ses_ prefix, which its built-in arguments add again.
export const OPENCODE_HISTORY = {
  DATA_HOME_ENV: "XDG_DATA_HOME",
  DATABASE_ENV: "OPENCODE_DB",
  DATABASE_FILE_NAME: "opencode.db",
  DEFAULT_DATA_HOME: ".local/share",
  FOLDER_NAME: "opencode",
  SESSION_ID_PREFIX: "ses_"
} as const;

// Copilot keeps a folder per conversation; its workspace.yaml is flat key: value lines.
export const COPILOT_HISTORY = {
  DEFAULT_HOME_FOLDER: ".copilot",
  EVENTS_FILE_NAME: "events.jsonl",
  HEAD_BYTES: 65_536,
  HOME_ENV: "COPILOT_HOME",
  READ_CONCURRENCY: 8,
  SESSIONS_FOLDER: "session-state",
  USER_MESSAGE_EVENT: "user.message",
  WORKSPACE_FILE_NAME: "workspace.yaml",
  WORKSPACE_LINE: /^(?<key>[a-z_]+):\s*(?<value>.*)$/u,
  WORKSPACE_QUOTES: /^["']|["']$/gu
} as const;

export const AGENT_HISTORY_TITLE = {
  LINE_BREAKS: /\s+/gu,
  MAX_LENGTH: 80
} as const;

export const SESSION_IMPORT_LABELS = {
  CHECKING: "Looking through each agent's history…",
  IMPORT: "Import",
  MAIN_FOLDER_SECTION: (agentName: string) => `${agentName} · main folder`,
  MENU: "Import Sessions…",
  NO_MATCH: "No conversation matches your search.",
  NONE: "No agent has a conversation in this project or its worktrees that isn't a session already.",
  SEARCH_PLACEHOLDER: "Search by title, worktree or branch",
  SELECT_ALL: "Select all",
  TITLE: (projectName: string) => `Import sessions into ${projectName}`,
  WORKTREES_SECTION: (agentName: string) => `${agentName} · worktrees`
} as const;
