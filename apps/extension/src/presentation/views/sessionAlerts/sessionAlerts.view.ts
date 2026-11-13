import {
  notifyOnDesktopForSessionAlertsView,
  watchSessionAlertsForSessionAlertsView
} from "@controllers/sessionAlert.controller.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {
  DESKTOP_NOTIFICATION,
  SESSION_ALERT_BLOCKED_HEADLINES,
  SESSION_ALERT_HEADLINES,
  SESSION_ALERT_LABELS,
  SESSION_LINK
} from "@pkg/constants/src/sessionAlert.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {makeSessionNodeId} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {Clock, Duration, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {SessionAlertDto} from "@dtos/sessionAlert.dto.ts";
import type {Uri} from "vscode";

// When this window last came into focus from another app or window, in milliseconds; 0 once a click has used it.
type WindowFocusedAt = SubscriptionRef.SubscriptionRef<number>;

const getSessionAlertHeadline = Effect.fn("SessionAlertsView.getSessionAlertHeadline")(function* (
  sessionAlert: SessionAlertDto
) {
  // Only a blocked session's alert carries the kind of wait.
  if (sessionAlert.statusKind !== undefined)
    return SESSION_ALERT_BLOCKED_HEADLINES[sessionAlert.statusKind](sessionAlert.displayName);

  return SESSION_ALERT_HEADLINES[sessionAlert.status](sessionAlert.displayName);
});

// Opens the session as its row's click does, so a failure shows the same way.
const openAlertedSession = Effect.fn("SessionAlertsView.openAlertedSession")(function* (sessionId: string) {
  const vsCodeApi = yield* VsCodeApi;
  const sessionNodeId = yield* makeSessionNodeId(sessionId);

  yield* Effect.promise(() => vsCodeApi.commands.executeCommand(SESSION_COMMANDS.OPEN, sessionNodeId));
});

// VS Code can't close the notification later, so it can outlive the state it tells about; Open still goes to the
// session.
const showInWindow = Effect.fn("SessionAlertsView.showInWindow")(function* (
  sessionAlert: SessionAlertDto,
  headline: string
) {
  const vsCodeApi = yield* VsCodeApi;
  const alertText = sessionAlert.statusMessage === undefined ? headline : `${headline}: ${sessionAlert.statusMessage}`;
  const pickedAction = yield* Effect.promise(() =>
    vsCodeApi.window.showInformationMessage(alertText, SESSION_ALERT_LABELS.OPEN)
  );

  if (pickedAction === SESSION_ALERT_LABELS.OPEN) yield* openAlertedSession(sessionAlert.sessionId);
});

// asExternalUri adds this window's id, so the window that sent the notification opens the session and comes forward.
const makeSessionLink = Effect.fn("SessionAlertsView.makeSessionLink")(function* (sessionId: string) {
  const vsCodeApi = yield* VsCodeApi;
  const sessionLink = vsCodeApi.Uri.from({
    authority: vsCodeApi.extensionId,
    path: SESSION_LINK.OPEN_SESSION_PATH,
    query: `${SESSION_LINK.SESSION_ID_PARAMETER}=${sessionId}`,
    scheme: vsCodeApi.env.uriScheme
  });
  const externalSessionLink = yield* Effect.promise(() => vsCodeApi.env.asExternalUri(sessionLink));

  return externalSessionLink.toString(true);
});

// A click on the notification brings VS Code's most recently used window forward. When that is this window, it came
// into focus around the moment the notification closed, which a dismissal doesn't do. GNOME closes every VS Code
// notification on a click, so the first alert to see the focus uses it up and the others open nothing.
const wasDesktopNotificationOpened = Effect.fn("SessionAlertsView.wasDesktopNotificationOpened")(function* (
  windowFocusedAt: WindowFocusedAt
) {
  const notificationClosedAt = yield* Clock.currentTimeMillis;
  const isClickFocus = (focusedAt: number) => focusedAt >= notificationClosedAt - DESKTOP_NOTIFICATION.CLICK_FOCUS_MS;
  const clickFocuses = Stream.take(Stream.filter(SubscriptionRef.changes(windowFocusedAt), isClickFocus), 1);
  const clickFocusResult = yield* Effect.result(
    Effect.timeout(Stream.runCollect(clickFocuses), Duration.millis(DESKTOP_NOTIFICATION.CLICK_FOCUS_MS))
  );
  if (Result.isFailure(clickFocusResult)) return false;

  return yield* SubscriptionRef.modify(windowFocusedAt, (focusedAt) =>
    isClickFocus(focusedAt) ? [true, 0] : [false, focusedAt]
  );
});

// Waits until the notification closes, then opens the session when the click brought this window forward.
const showOnDesktop = Effect.fn("SessionAlertsView.showOnDesktop")(function* (
  sessionAlert: SessionAlertDto,
  headline: string,
  windowFocusedAt: WindowFocusedAt
) {
  const vsCodeApi = yield* VsCodeApi;
  const openLink = yield* makeSessionLink(sessionAlert.sessionId);

  yield* notifyOnDesktopForSessionAlertsView({
    agentIconPath: sessionAlert.icon,
    aggregorIconPath: vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, DESKTOP_NOTIFICATION.AGGREGOR_ICON).fsPath,
    headline,
    message: sessionAlert.statusMessage === undefined ? "" : sessionAlert.statusMessage,
    openLink
  });
  if (yield* wasDesktopNotificationOpened(windowFocusedAt)) yield* openAlertedSession(sessionAlert.sessionId);
});

// The focused window shows the alert itself; an unfocused one hands it to the system, since another app may be in
// front. In the background, so a notification waiting for a click holds back no other. A failure is logged.
const showSessionAlert = Effect.fn("SessionAlertsView.showSessionAlert")(function* (
  sessionAlert: SessionAlertDto,
  windowFocusedAt: WindowFocusedAt
) {
  const vsCodeApi = yield* VsCodeApi;
  const headline = yield* getSessionAlertHeadline(sessionAlert);
  const shownAlert = vsCodeApi.window.state.focused
    ? showInWindow(sessionAlert, headline)
    : showOnDesktop(sessionAlert, headline, windowFocusedAt);

  yield* Effect.forkScoped(
    Effect.catch(shownAlert, (alertError) => Effect.logWarning("Could not show a session alert", alertError))
  );
});

// A WSL toast's click lands here, in the window that sent it.
const openLinkedSession = Effect.fn("SessionAlertsView.openLinkedSession")(function* (sessionLink: Uri) {
  const sessionId = new URLSearchParams(sessionLink.query).get(SESSION_LINK.SESSION_ID_PARAMETER);
  if (sessionLink.path === SESSION_LINK.OPEN_SESSION_PATH && sessionId !== null)
    return yield* openAlertedSession(sessionId);

  return yield* Effect.logWarning("Ignored a link that opens no session", sessionLink.toString(true));
});

const registerSessionLinkHandler = Effect.fn("SessionAlertsView.registerSessionLinkHandler")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const viewContext = yield* Effect.context<VsCodeApi>();
  const runPromise = Effect.runPromiseWith(viewContext);

  yield* acquireScopedDisposable(() =>
    vsCodeApi.window.registerUriHandler({handleUri: (sessionLink) => runPromise(openLinkedSession(sessionLink))})
  );
});

// Records each time this window comes into focus; a change of only `active` while focused isn't one.
const trackWindowFocus = Effect.fn("SessionAlertsView.trackWindowFocus")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const windowFocusedAt = yield* SubscriptionRef.make(0);
  const windowStateChanges = yield* streamVsCodeEvent(vsCodeApi.window.onDidChangeWindowState);
  const focusChanges = Stream.changesWith(
    Stream.map(windowStateChanges, (windowState) => windowState.focused),
    (wasFocused, isFocused) => wasFocused === isFocused
  );

  yield* Effect.forkScoped(
    Stream.runForEach(Stream.filter(focusChanges, Boolean), () =>
      Effect.flatMap(Clock.currentTimeMillis, (focusedAt) => SubscriptionRef.set(windowFocusedAt, focusedAt))
    )
  );

  return windowFocusedAt;
});

// Notifies about the states sessions out of view hold, for the lifetime of the runtime.
const makeSessionAlertsView = Effect.fn("SessionAlertsView.make")(function* () {
  yield* registerSessionLinkHandler();
  const windowFocusedAt = yield* trackWindowFocus();
  const sessionAlerts = yield* watchSessionAlertsForSessionAlertsView();

  yield* Effect.forkScoped(
    Stream.runForEach(sessionAlerts, (sessionAlert) => showSessionAlert(sessionAlert, windowFocusedAt))
  );
});

export const SessionAlertsView = Layer.effectDiscard(makeSessionAlertsView());
