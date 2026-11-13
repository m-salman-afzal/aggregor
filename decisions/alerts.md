# Alerts

How a session out of view gets the user's attention: notifications and badge counts.

## Sessions out of view notify, and the view's badge counts those waiting on you

- **Problem:** an agent that waits for permission or finishes while the user looks elsewhere, in VS Code or in another
  app, goes unnoticed until they look at its row.
- **Decision:**
  - `SessionAlertService.watchSessionAlerts` watches the session rows: a write whose `statusChangedAt` moved since the
    window started, with a new state or kind of wait, is a change. Each session's changes pass once they have held for 3
    seconds (`SESSION_ALERT_HOLD_MS`), and only when the state differs from the one held before; idle held after working
    counts as done (`getAlertedStatus`). The session must be out of view when the state changed and once it held, and
    the state in `aggregorApp.notifyOn` (default: blocked, done, error, idle).
  - `SessionAlertsView` shows each alert: the focused window as its own notification with **Open**, which runs the open
    command; an unfocused one through `IDesktopNotificationInfraService`.
  - On Linux, `notify-send --wait` with `NOTIFY_IGNORE_PORTAL=1`, a `desktop-entry` hint naming VS Code's desktop file
    (from `CHROME_DESKTOP`, `com.microsoft.VSCode.desktop` in 1.145), the agent's logo as the `image-path` hint and
    Aggregor's light logo as `--app-icon`, with no button. GNOME Shell 50 (`notificationDaemon.js`) then files the
    notification under VS Code, so its header shows VS Code's name and icon, and a click on it runs `app.activate()`,
    which brings VS Code's most recently used window forward and switches to its workspace, as for Ghostty. `--wait`
    keeps `notify-send` connected: GNOME deletes a notification filed under an app as soon as its sender leaves the bus.
    libnotify routes a snap's or flatpak's notifications through the portal, which drops hints, and the extension host
    can inherit a snap terminal's environment.
  - GNOME tells the sender only that the notification closed, the same for a click as for its X, so the window opens the
    session when it came into focus within 1.5 seconds of that (`DESKTOP_NOTIFICATION.CLICK_FOCUS_MS`). A click closes
    every VS Code notification at once, so the first alert to see the focus uses it up and the others open nothing.
  - From WSL (a kernel release naming microsoft), a PowerShell toast whose click opens a link
    (`vscode://salmanafzal.aggregor-app/openSession?sessionId=…`, from `env.asExternalUri`, which adds the window's id)
    through Windows; the view's URI handler opens the session, and VS Code asks once whether the extension may open
    links. On macOS, `osascript`'s `display notification`, whose click opens Script Editor. Neither shows the logos:
    osascript always shows Script Editor's icon, and toasts take PNG or JPG, not the SVG logos. Native Windows sends
    none, since its sessions run in WSL.
  - The Sessions view's badge, which VS Code also shows on the activity bar, counts the sessions blocked, errored or
    with a finished turn unseen (`isSessionWaitingOnUser`), and its tooltip lists them; it is read again on every
    session list change.

  A state that holds is news, quick sequences raise one notification, and Antigravity's 2-second sign-in check at every
  start raises none. Only GNOME may bring VS Code forward, and it does so for a notification it files under VS Code.

- **Solution:** VS Code can't close a notification once shown, so one can outlive its state; Open still goes to the
  session. Each window sends its own, so two windows notify twice. With several VS Code windows, a click brings the most
  recently used one forward, which may not be the one that sent it; that one then opens nothing (see "If the users
  asked" in the README). Focusing the window within 1.5 seconds of dismissing a notification with its X opens the
  session too. A desktop notification waiting keeps a `notify-send` process until it is clicked or dismissed, and
  Ubuntu's AppArmor profile for `notify-send` keeps VS Code from stopping it, so it outlives a reload. The WSL toast and
  macOS notification are untested.
- **Alternatives considered:**
  - Bringing the window forward from an OS notification by running `code ‹workspace›`: an untitled workspace, which
    Aggregor's window becomes, has no path to pass.
  - An **Open** button on the desktop notification whose click opened the window's link through `xdg-open` (built and
    tried): GNOME on Wayland lets a window come forward only with an activation token, which a click hands to the
    program that sent the notification, `notify-send`. VS Code can't take one from outside: its code never reads
    `XDG_ACTIVATION_TOKEN`, and it doesn't use Electron's `requestSingleInstanceLock`, the way Chromium passes a token
    to a running instance. So the link opened the session, and GNOME kept VS Code in the background.
  - Bringing the right window forward when several VS Code windows are open: kept for "If the users asked" in the
    README, with the problem and a proposal.
  - Only the Linux notification for now, macOS and WSL when someone runs them: dropped, so the release has them for
    contributors to try.
  - Removing `notifyOn` until it is wanted: kept, so the states can be picked.

## Each list's header counts its sessions waiting on you

- **Problem:** the activity-bar badge counts the sessions waiting on the user in both lists, so with archived agents
  left running, a finished one in the Archive raises the count without saying where it is.
- **Decision:** each list's header in the webview shows the number of its sessions waiting on the user (a finished turn
  unseen, a question, a failure) as a small badge in the waiting colour while there are any. The activity bar's badge
  counts both lists, and shows from any other tab.
- **Solution:** the view reads `listSessionsWaitingOnUser` on every change of the session list;
  `countViewSessionsWaitingOnUser` in `sessions.utils.ts` picks a list's sessions by `isArchived`, and the view sends
  both counts in `WaitingCountsDrawn`.
- **Alternatives considered:** the count in the view's name, `Sessions (2)`, which VS Code's header repeated beside the
  container's name; the view's description, too faint to read and hidden while the view is collapsed.

## An agent exiting doesn't alert by default

- **Problem:** an agent exits mostly because the user stopped it, and Stop Agents, Stop All Agents and archiving with
  Stop Agents raised one exited alert per agent (m3 2's "Agents stop from the session, project and view menus").
- **Decision:** `aggregorApp.notifyOn` defaults to blocked, done, error and idle; `exited` stays a choice in the
  setting. A user who set the setting keeps their own list. The user asked for it, and an exit the user caused is no
  news.
