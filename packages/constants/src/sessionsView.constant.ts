import {APP_COMMANDS} from "@pkg/constants/src/app.constant.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";

export const SESSIONS_VIEW = {
  FOCUS_COMMAND: "aggregorApp.sessions.focus",
  ID: "aggregorApp.sessions",
  SHOW_PROMPT_COMMAND: "aggregorApp.showPromptInSessionsView"
} as const;

export const PROMPT_TAGS = {
  CHOICE: "ChoicePrompt",
  QUESTION: "QuestionPrompt",
  TEXT: "TextPrompt"
} as const;

export const PROMPT_ACTION_ICONS = {
  STAR: "star"
} as const;

export const PROMPT_ANSWER_TAGS = {
  CANCELLED: "PromptCancelled",
  CHOSEN: "ChoiceChosen",
  TEXT_ENTERED: "TextEntered"
} as const;

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

export const SESSIONS_VIEW_MESSAGE_TAGS = {
  APPEARANCE_DRAWN: "AppearanceDrawn",
  ARCHIVE_DRAWN: "ArchiveDrawn",
  PROJECT_SESSIONS_DRAWN: "ProjectSessionsDrawn",
  PROJECTS_DRAWN: "ProjectsDrawn",
  PROMPT_SHOWN: "PromptShown",
  SESSION_DRAWN: "SessionDrawn",
  VIEWED_SESSION_CHANGED: "ViewedSessionChanged",
  WAITING_COUNTS_DRAWN: "WaitingCountsDrawn"
} as const;

export const SESSIONS_WEBVIEW_MESSAGE_TAGS = {
  PROMPT_ANSWERED: "PromptAnswered",
  READY: "Ready",
  RUN_COMMAND: "RunCommand"
} as const;

// The view runs no other command the webview asks for.
export const SESSIONS_WEBVIEW_COMMANDS = [
  APP_COMMANDS.OPEN_SETTINGS,
  PROJECT_COMMANDS.ADD,
  PROJECT_COMMANDS.MOVE_DOWN,
  PROJECT_COMMANDS.MOVE_UP,
  PROJECT_COMMANDS.REMOVE,
  SESSION_COMMANDS.ARCHIVE,
  SESSION_COMMANDS.ARCHIVE_ONGOING,
  SESSION_COMMANDS.ARCHIVE_PROJECT_SESSIONS,
  SESSION_COMMANDS.MOVE_DOWN,
  SESSION_COMMANDS.MOVE_UP,
  SESSION_COMMANDS.NEW_ASKING_FOR_PROJECT,
  SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT,
  SESSION_COMMANDS.OPEN,
  SESSION_COMMANDS.REMOVE,
  SESSION_COMMANDS.RENAME,
  SESSION_COMMANDS.STOP_AGENT,
  SESSION_COMMANDS.STOP_ARCHIVED_AGENTS,
  SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS,
  SESSION_COMMANDS.STOP_ONGOING_AGENTS,
  SESSION_COMMANDS.STOP_PROJECT_AGENTS,
  SESSION_COMMANDS.UNARCHIVE
] as const;

// Scripts run only with the page's nonce or from the dev server; React's refresh runtime goes in before any component.
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

export const SESSIONS_VIEW_SETTINGS = {
  ACCENT_COLOR: "accentColor",
  ACCENT_COLOR_PATTERN: /^(?:neutral|theme|palette|#[\dA-Fa-f]{6})$/u,
  DEFAULT_ACCENT_COLOR: "neutral",
  DEFAULT_FONT_SIZE: 14,
  FONT_SIZE: "fontSize"
} as const;

export const SESSIONS_VIEW_NODE_TAGS = {
  PROJECT: "ProjectNode",
  SESSION: "SessionNode"
} as const;

export const SESSIONS_VIEW_NODE_ID_PREFIXES = {
  PROJECT: "project:",
  SESSION: "session:"
} as const;

export const STATUS_LABELS = {
  blocked: "needs input",
  done: "finished",
  error: "failed",
  exited: "exited",
  idle: "idle",
  working: "working"
} as const;

export const STATUS_KIND_LABELS = {
  auth: "needs sign-in",
  permission: "needs permission",
  question: "has a question"
} as const;

export const VIEW_BADGE_LABELS = {
  TOOLTIP_LINE: (displayName: string, statusLabel: string) => `${displayName} · ${statusLabel}`
} as const;

export const SESSION_ROW_LABELS = {
  TOOLTIP_HEADING: (sessionName: string, statusLabel: string) => `${sessionName} · ${statusLabel}`
} as const;
