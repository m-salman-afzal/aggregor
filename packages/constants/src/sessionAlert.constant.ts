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

// Aggregor's logo in a desktop notification's header, inside the extension; the light one suits the dark notifications
// GNOME draws.
export const DESKTOP_NOTIFICATION_AGGREGOR_ICON = "assets/aggregorLightIcon.svg";

// GNOME brings VS Code forward when a desktop notification is clicked, and tells the sender only that it closed, as it
// does for its X; this window coming into focus this close to the notification closing counts as the click.
export const DESKTOP_NOTIFICATION_CLICK_FOCUS_MS = 1500;

// A WSL toast's click opens this link, which the extension handles in the window that sent it.
export const SESSION_LINK = {
  OPEN_SESSION_PATH: "/openSession",
  SESSION_ID_PARAMETER: "sessionId"
} as const;
