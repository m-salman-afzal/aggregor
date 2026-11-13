import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";

export const SESSIONS_VIEW = {
  ID: "aggregorApp.sessions"
} as const;

// The view is a webview that apps/webview draws: its build in the extension's dist/webview, or its dev server when F5
// sets the variable to the server's URL. It mounts on the root element.
export const SESSIONS_WEBVIEW = {
  BUILD_FOLDER: "dist/webview",
  DEVELOPMENT_SERVER_ENTRY_PATH: "/src/main.tsx",
  DEVELOPMENT_SERVER_URL_VARIABLE: "AGGREGOR_WEBVIEW_DEV_SERVER_URL",
  // The dev server's socket URL is its URL with ws in place of http.
  HTTP_SCHEME_PATTERN: /^http/u,
  ROOT_ELEMENT_ID: "root",
  SCRIPT_FILE_NAME: "webview.js",
  STYLE_FILE_NAME: "webview.css"
} as const;

// The tags of the messages the view sends its webview, and those the webview sends back.
export const SESSIONS_VIEW_MESSAGE_TAGS = {
  PROJECT_SESSIONS_DRAWN: "ProjectSessionsDrawn",
  PROJECTS_DRAWN: "ProjectsDrawn",
  SESSION_DRAWN: "SessionDrawn",
  VIEWED_SESSION_CHANGED: "ViewedSessionChanged"
} as const;

export const SESSIONS_WEBVIEW_MESSAGE_TAGS = {
  READY: "Ready",
  RUN_COMMAND: "RunCommand"
} as const;

// The commands the webview may ask the view to run; the view runs no other.
export const SESSIONS_WEBVIEW_COMMANDS = [SESSION_COMMANDS.OPEN, PROJECT_COMMANDS.ADD] as const;

// The webview's page. Its scripts run only with the page's nonce or from the dev server, which also injects styles and
// keeps a socket open for hot reload; React's refresh runtime goes in before any component loads.
export const SESSIONS_WEBVIEW_HTML = {
  BUILT: (builtPage: Readonly<Record<"cspSource" | "nonce" | "scriptUri" | "styleUri", string>>) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${builtPage.cspSource}; font-src ${builtPage.cspSource}; style-src ${builtPage.cspSource}; script-src 'nonce-${builtPage.nonce}'" />
    <link rel="stylesheet" href="${builtPage.styleUri}" />
  </head>
  <body>
    <div id="${SESSIONS_WEBVIEW.ROOT_ELEMENT_ID}"></div>
    <script type="module" nonce="${builtPage.nonce}" src="${builtPage.scriptUri}"></script>
  </body>
</html>`,
  DEVELOPMENT_SERVER: (
    developmentServerPage: Readonly<
      Record<"cspSource" | "developmentServerSocketUrl" | "developmentServerUrl" | "nonce", string>
    >
  ) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${developmentServerPage.cspSource} ${developmentServerPage.developmentServerUrl}; font-src ${developmentServerPage.cspSource} ${developmentServerPage.developmentServerUrl}; style-src ${developmentServerPage.developmentServerUrl} 'unsafe-inline'; script-src 'nonce-${developmentServerPage.nonce}' ${developmentServerPage.developmentServerUrl}; connect-src ${developmentServerPage.developmentServerUrl} ${developmentServerPage.developmentServerSocketUrl}" />
    <script type="module" nonce="${developmentServerPage.nonce}">
      import RefreshRuntime from "${developmentServerPage.developmentServerUrl}/@react-refresh";
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module" src="${developmentServerPage.developmentServerUrl}/@vite/client"></script>
  </head>
  <body>
    <div id="${SESSIONS_WEBVIEW.ROOT_ELEMENT_ID}"></div>
    <script type="module" src="${developmentServerPage.developmentServerUrl}${SESSIONS_WEBVIEW.DEVELOPMENT_SERVER_ENTRY_PATH}"></script>
  </body>
</html>`
} as const;

// The view's name, as the manifest gives it, and with the number of its sessions waiting on the user.
export const SESSIONS_VIEW_LABELS = {
  TITLE: "Sessions",
  TITLE_WITH_WAITING_COUNT: (waitingCount: number) => `Sessions (${waitingCount})`
} as const;

// A row's node id is its kind's prefix, then the project's path or the session's id. VS Code finds a tree node to
// redraw by its id, and the row's commands take it, from a tree's menus or from the webview.
// The tag of a node id read back: a project row's or a session row's.
export const SESSIONS_VIEW_NODE_TAGS = {
  PROJECT: "ProjectNode",
  SESSION: "SessionNode"
} as const;

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

// The Archive tree's theme icons: a plain root folder for a project, since any folder can be one, git or not, and a
// warning for a session whose agent is gone from the agents setting.
export const ROW_ICONS = {
  MISSING_AGENT: "warning",
  PROJECT: "root-folder"
} as const;

// Each Archive tree session row gets a URI in this scheme so a FileDecorationProvider can draw its status badge.
export const SESSION_BADGE_URI_SCHEME = "aggregor-session";

// The badge at the end of an Archive tree session row; an idle session has none. Working steps through its frames, one
// per SPINNER_FRAME_INTERVAL_MS. Colors are theme color ids, and VS Code tints the row's label with them too.
export const STATUS_BADGES = {
  blocked: {color: "charts.yellow", frames: ["●"]},
  done: {color: "charts.green", frames: ["✓"]},
  error: {color: "errorForeground", frames: ["✕"]},
  exited: {color: "disabledForeground", frames: ["○"]},
  idle: undefined,
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

// The view's badge, which VS Code also shows on the activity bar, lists the sessions waiting on the user when hovered.
export const VIEW_BADGE_LABELS = {
  TOOLTIP_LINE: (displayName: string, statusLabel: string) => `${displayName} · ${statusLabel}`
} as const;

// An Archive tree session row's texts.
export const SESSION_ROW_LABELS = {
  ACCESSIBLE: (displayName: string, projectName: string, statusLabel: string) =>
    `${displayName}, ${projectName}, ${statusLabel}`,
  OPEN_SESSION: "Open Session",
  TOOLTIP_HEADING: (sessionName: string, statusLabel: string) => `${sessionName} · ${statusLabel}`
} as const;
