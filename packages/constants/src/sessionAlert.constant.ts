// A state notifies only once it has held this long, so quick sequences raise one notification and Antigravity's
// 2-second sign-in check at every start raises none.
export const SESSION_ALERT_HOLD_MS = 3000;

export const SESSION_ALERT_LABELS = {
  OPEN: "Open"
} as const;

// What a notification says first, by the state the session holds; the agent's message, when it sent one, follows.
export const SESSION_ALERT_HEADLINES = {
  blocked: (displayName: string) => `${displayName} is waiting for you`,
  done: (displayName: string) => `${displayName} finished`,
  error: (displayName: string) => `${displayName} stopped with an error`,
  exited: (displayName: string) => `${displayName}'s agent exited`,
  idle: (displayName: string) => `${displayName} is idle`,
  unknown: (displayName: string) => `${displayName} stopped reporting its status`,
  working: (displayName: string) => `${displayName} is working`
} as const;

// A blocked session's headline when its agent says what it waits for.
export const SESSION_ALERT_BLOCKED_HEADLINES = {
  auth: (displayName: string) => `${displayName} needs you to sign in`,
  permission: (displayName: string) => `${displayName} needs approval`,
  question: (displayName: string) => `${displayName} has a question`
} as const;

export const DESKTOP_NOTIFICATION = {
  // Aggregor's logo in the notification's header, inside the extension; the light one suits the dark notifications
  // GNOME draws.
  AGGREGOR_ICON: "assets/aggregorLightIcon.svg",
  // GNOME brings VS Code forward when a notification is clicked, and tells the sender only that it closed, as it does
  // for its X; this window coming into focus this close to the notification closing counts as the click.
  CLICK_FOCUS_MS: 1500
} as const;

// The command each system shows a desktop notification with.
export const DESKTOP_NOTIFIERS = {
  // Linux. The desktop file Electron names VS Code's processes after (com.microsoft.VSCode.desktop) files the
  // notification under VS Code, so a click brings VS Code's most recently used window forward.
  NOTIFY_SEND: {
    COMMAND: "notify-send",
    DESKTOP_FILE_ENV: "CHROME_DESKTOP",
    DESKTOP_FILE_EXTENSION: /\.desktop$/u,
    IGNORE_PORTAL_ENV: "NOTIFY_IGNORE_PORTAL"
  },
  // macOS. The texts arrive as the script's arguments, so no quote in them reaches it.
  OSASCRIPT: {
    COMMAND: "osascript",
    SCRIPT_LINES: ["on run argv", "display notification (item 2 of argv) with title (item 1 of argv)", "end run"]
  },
  // WSL, through Windows. A toast under the app id PowerShell's own toasts go out under needs no registration.
  POWERSHELL: {
    APP_ID: "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe",
    COMMAND: "powershell.exe"
  }
} as const;

// A WSL toast's click opens this link, which the extension handles in the window that sent it.
export const SESSION_LINK = {
  OPEN_SESSION_PATH: "/openSession",
  SESSION_ID_PARAMETER: "sessionId"
} as const;
