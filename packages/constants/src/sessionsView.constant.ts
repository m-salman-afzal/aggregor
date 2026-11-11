// The view's id, and the tree's own drag and drop type, application/vnd.code.tree.<view id in lower case>, which VS Code
// keeps the dragged rows' items under within the tree.
export const SESSIONS_VIEW = {
  DRAG_MIME_TYPE: "application/vnd.code.tree.aggregorapp.sessions",
  ID: "aggregorApp.sessions"
} as const;

// The view's name, as the manifest gives it, and with the number of its sessions waiting on the user.
export const SESSIONS_VIEW_LABELS = {
  TITLE: "Sessions",
  TITLE_WITH_WAITING_COUNT: (waitingCount: number) => `Sessions (${waitingCount})`
} as const;

// A tree node's id is its kind's prefix, then the project's path or the session's id. VS Code finds the node to redraw
// by its id, and passes the id to the row's menu commands.
export const SESSIONS_VIEW_NODE_ID_PREFIXES = {
  PROJECT: "project:",
  SESSION: "session:"
} as const;

// A row's context value is its kind, then the ways it can move, then a session's running agent, separated by spaces;
// the manifest's menus match these words: only an added project can be removed from the list, Move Up and Move Down
// show only where they move, and Stop Agent only while the agent runs.
export const SESSIONS_VIEW_CONTEXT_VALUES = {
  ADDED_PROJECT: "addedProject",
  AGENT_RUNNING: "agentRunning",
  CAN_MOVE_DOWN: "canMoveDown",
  CAN_MOVE_UP: "canMoveUp",
  PROJECT: "project",
  SESSION: "session"
} as const;

// The rows' theme icons: a plain root folder for a project, since any folder can be one, git or not, and a warning for a
// session whose agent is gone from the agents setting.
export const ROW_ICONS = {
  MISSING_AGENT: "warning",
  PROJECT: "root-folder"
} as const;

// Each session row gets a URI in this scheme so a FileDecorationProvider can draw its status badge.
export const SESSION_BADGE_URI_SCHEME = "aggregor-session";

// The badge at the end of a session row; an idle session has none. Working steps through its frames, one per
// SPINNER_FRAME_INTERVAL_MS. Colors are theme color ids, and VS Code tints the row's label with them too.
export const STATUS_BADGES = {
  blocked: {color: "charts.yellow", frames: ["●"]},
  done: {color: "charts.green", frames: ["✓"]},
  error: {color: "errorForeground", frames: ["✕"]},
  exited: {color: "disabledForeground", frames: ["○"]},
  idle: undefined,
  working: {color: "charts.blue", frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]}
} as const;

export const SPINNER_FRAME_INTERVAL_MS = 120;

// VS Code draws a new row a moment after the change that adds it, so selecting it is retried this often, this many times.
export const SELECT_ROW_RETRY = {
  INTERVAL_MS: 250,
  TIMES: 8
} as const;

export const STATUS_LABELS = {
  blocked: "needs input",
  done: "finished",
  error: "failed",
  exited: "exited",
  idle: "idle",
  working: "working"
} as const;

// What a blocked session waits for, when its agent says.
export const STATUS_KIND_LABELS = {
  auth: "needs sign-in",
  permission: "needs permission",
  question: "has a question"
} as const;

// The view's badge, which VS Code also shows on the activity bar, lists the sessions waiting on the user when hovered.
export const VIEW_BADGE_LABELS = {
  TOOLTIP_LINE: (displayName: string, statusLabel: string) => `${displayName} · ${statusLabel}`
} as const;

export const SESSION_ROW_LABELS = {
  ACCESSIBLE: (displayName: string, projectName: string, statusLabel: string) =>
    `${displayName}, ${projectName}, ${statusLabel}`,
  OPEN_SESSION: "Open Session",
  TOOLTIP_HEADING: (sessionName: string, statusLabel: string) => `${sessionName} · ${statusLabel}`
} as const;
