import {SessionsCorrupt, SessionsSaveFailed} from "@/errors/session.error.ts";
import {showErrorInBackground} from "@/services/error.utils.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {fromEvent} from "@/services/vscode.utils.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Context, Effect, Layer, Schema, Stream, SubscriptionRef} from "effect";

import type {Memento, WindowState} from "vscode";

const SessionSchema = Schema.Struct({
  cwd: Schema.String,
  id: Schema.String,
  name: Schema.String
});

export type Session = typeof SessionSchema.Type;

// Any change to this shape bumps `version`, so windows still running older code fail to decode it instead of
// writing back a copy with the new fields stripped.
const StoredSessions = Schema.Struct({
  sessions: Schema.Array(SessionSchema),
  version: Schema.Literal(1)
});

const NO_STORED_SESSIONS: typeof StoredSessions.Encoded = {sessions: [], version: 1};

// This window's copy of the stored sessions, which the view renders from.
type SessionsReference = SubscriptionRef.SubscriptionRef<readonly Session[]>;

// Re-reads globalState on every call.
const loadSessions = Effect.fn("SessionStore.loadSessions")(
  function* (globalState: Memento) {
    const storedValue = yield* Effect.sync(() => globalState.get<unknown>(STORAGE_KEYS.SESSIONS, NO_STORED_SESSIONS));
    const storedSessions = yield* Schema.decodeUnknownEffect(StoredSessions)(storedValue);

    return storedSessions.sessions;
  },
  Effect.mapError((cause) => new SessionsCorrupt({cause}))
);

const saveSessions = Effect.fn("SessionStore.saveSessions")(function* (
  globalState: Memento,
  sessions: readonly Session[]
) {
  const storedValue: typeof StoredSessions.Encoded = {sessions, version: 1};

  yield* Effect.tryPromise({
    catch: (cause) => new SessionsSaveFailed({cause}),
    try: async () => globalState.update(STORAGE_KEYS.SESSIONS, storedValue)
  });
});

const showUnreadableSessionsError = Effect.fn("SessionStore.showUnreadableSessionsError")(function* () {
  yield* showErrorInBackground(SESSION_MESSAGES.UNREADABLE);
  const noSessions: readonly Session[] = [];

  return noSessions;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialSessions = Effect.fn("SessionStore.loadInitialSessions")(
  function* (globalState: Memento) {
    return yield* loadSessions(globalState);
  },
  Effect.catchTag("SessionsCorrupt", () => showUnreadableSessionsError())
);

// Other windows write to the same globalState; pick up their changes when this window comes back into focus.
const reloadSessionsOnFocus = Effect.fn("SessionStore.reloadSessionsOnFocus")(
  function* (globalState: Memento, sessions: SessionsReference, windowState: WindowState) {
    if (!windowState.focused) return;

    yield* SubscriptionRef.updateEffect(sessions, () => loadSessions(globalState));
  },
  Effect.catchTag("SessionsCorrupt", (sessionsCorrupt) =>
    Effect.andThen(Effect.logError(SESSION_MESSAGES.UNREADABLE, sessionsCorrupt.cause), showUnreadableSessionsError())
  )
);

const makeSessionStore = Effect.fn("SessionStore.make")(function* () {
  const {globalState, window} = yield* VsCodeService;
  const sessions: SessionsReference = yield* SubscriptionRef.make(yield* loadInitialSessions(globalState));
  yield* Effect.forkScoped(
    Stream.runForEach(fromEvent(window.onDidChangeWindowState), (windowState) =>
      reloadSessionsOnFocus(globalState, sessions, windowState)
    )
  );

  return {
    loadSessions: () => loadSessions(globalState),
    saveSessions: (nextSessions: readonly Session[]) => saveSessions(globalState, nextSessions),
    sessions
  };
});

// globalState is the source of truth, shared by every window; `sessions` is this window's copy for the view.
export class SessionStore extends Context.Service<
  SessionStore,
  {
    readonly loadSessions: () => Effect.Effect<readonly Session[], SessionsCorrupt>;
    readonly saveSessions: (sessions: readonly Session[]) => Effect.Effect<void, SessionsSaveFailed>;
    readonly sessions: SessionsReference;
  }
>()("aggregor/services/session/store.service/SessionStore") {
  public static readonly layer = Layer.effect(SessionStore, makeSessionStore());
}
