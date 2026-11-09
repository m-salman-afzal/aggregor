export const SESSIONS_VIEW_ID = "aggregorApp.sessions";

// The manifest's menus pick rows by these: only an added project can be removed from the list.
export const SESSIONS_VIEW_CONTEXT_VALUES = {
  ADDED_PROJECT: "addedProject",
  PROJECT: "project",
  SESSION: "session"
} as const;

// Any folder can be a project, git or not, so the icon is a plain root folder.
export const PROJECT_ROW_ICON = "root-folder";

// Each session row gets a URI in this scheme so a FileDecorationProvider can draw its status badge.
export const SESSION_BADGE_URI_SCHEME = "aggregor-session";

// The badge at the end of a session row; an idle session has none. Working steps through its frames, one per
// SPINNER_FRAME_INTERVAL_MS. Colors are theme color ids, and VS Code tints the row's label with them too.
export const STATUS_BADGES = {
  blocked: {color: "charts.yellow", frames: ["●"]},
  done: {color: "charts.green", frames: ["✓"]},
  error: {color: "errorForeground", frames: ["✕"]},
  exited: {color: "disabledForeground", frames: ["○"]},
  working: {color: "charts.blue", frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]}
} as const;

export const SPINNER_FRAME_INTERVAL_MS = 120;

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

export const SESSION_ROW_LABELS = {
  ACCESSIBLE: (displayName: string, projectName: string, statusLabel: string) =>
    `${displayName}, ${projectName}, ${statusLabel}`,
  OPEN_SESSION: "Open Session",
  // The agent's message, such as the permission it asks for, sits between the name and the folder.
  TOOLTIP: ({
    sessionName,
    statusLabel,
    statusMessage,
    workingDirectory
  }: {
    readonly sessionName: string;
    readonly statusLabel: string;
    readonly statusMessage: string | undefined;
    readonly workingDirectory: string;
  }) =>
    [`${sessionName} · ${statusLabel}`, ...(statusMessage === undefined ? [] : [statusMessage]), workingDirectory].join(
      "\n"
    )
} as const;
