import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {SessionEntity} from "@entities/session/session.entity.ts";
import {
  ISessionRepository,
  SessionsCorruptError,
  SessionsSaveFailedError
} from "@entities/session/session.repository.interface.ts";
import {fromEvent} from "@infraUtils/vscode.utils.ts";
import {NO_STORED_SESSIONS, StoredSessionsModel} from "@models/storedSessions.model.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Array, Effect, Layer, Schema, Stream, SubscriptionRef} from "effect";

import type {Memento, WindowState} from "vscode";

type ChangeSessions<ChangeResult> = (
  storedSessions: readonly SessionEntity[]
) => Effect.Effect<readonly [ChangeResult, readonly SessionEntity[]]>;

// This window's copy of the stored sessions, which the view renders from.
type SessionsReference = SubscriptionRef.SubscriptionRef<readonly SessionEntity[]>;

// Re-reads globalState on every call.
const loadSessions = Effect.fn("SessionRepository.loadSessions")(
  function* (globalState: Memento) {
    const storedValue = yield* Effect.sync(() =>
      globalState.get<unknown>(STORAGE_KEYS.SAVED_SESSIONS, NO_STORED_SESSIONS)
    );
    const storedSessions = yield* Schema.decodeUnknownEffect(StoredSessionsModel)(storedValue);

    return Array.map(storedSessions.sessions, (storedSession) => SessionEntity.make(storedSession));
  },
  Effect.mapError((cause) => SessionsCorruptError.make({cause}))
);

const saveSessions = Effect.fn("SessionRepository.saveSessions")(function* (
  globalState: Memento,
  sessions: readonly SessionEntity[]
) {
  const storedValue = yield* Effect.mapError(
    Schema.encodeEffect(StoredSessionsModel)({sessions, version: 1}),
    (cause) => SessionsSaveFailedError.make({cause})
  );

  yield* Effect.tryPromise({
    catch: (cause) => SessionsSaveFailedError.make({cause}),
    try: () => globalState.update(STORAGE_KEYS.SAVED_SESSIONS, storedValue)
  });
});

const writeSessionsChange = Effect.fn("SessionRepository.writeSessionsChange")(function* <ChangeResult>(
  globalState: Memento,
  changeSessions: ChangeSessions<ChangeResult>
) {
  const currentSessions = yield* loadSessions(globalState);
  const [changeResult, nextSessions] = yield* changeSessions(currentSessions);
  yield* saveSessions(globalState, nextSessions);

  return [changeResult, nextSessions] as const;
});

// Read-modify-write against globalState under the ref's permit, so a change never drops what another window saved.
const modifySessions = Effect.fn("SessionRepository.modifySessions")(function* <ChangeResult>(
  globalState: Memento,
  sessions: SessionsReference,
  changeSessions: ChangeSessions<ChangeResult>
) {
  return yield* SubscriptionRef.modifyEffect(sessions, () => writeSessionsChange(globalState, changeSessions));
});

const showUnreadableSessionsError = Effect.fn("SessionRepository.showUnreadableSessionsError")(function* () {
  yield* showErrorInBackground(SESSION_MESSAGES.UNREADABLE);
  const noSessions: readonly SessionEntity[] = [];

  return noSessions;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialSessions = Effect.fn("SessionRepository.loadInitialSessions")(
  function* (globalState: Memento) {
    return yield* loadSessions(globalState);
  },
  Effect.catchTag("SessionsCorruptError", () => showUnreadableSessionsError())
);

// Other windows write to the same globalState; pick up their changes when this window comes back into focus.
const reloadSessionsOnFocus = Effect.fn("SessionRepository.reloadSessionsOnFocus")(
  function* (globalState: Memento, sessions: SessionsReference, windowState: WindowState) {
    if (!windowState.focused) return;

    yield* SubscriptionRef.updateEffect(sessions, () => loadSessions(globalState));
  },
  Effect.catchTag("SessionsCorruptError", (sessionsCorrupt) =>
    Effect.andThen(Effect.logError(SESSION_MESSAGES.UNREADABLE, sessionsCorrupt.cause), showUnreadableSessionsError())
  )
);

const makeSessionRepository = Effect.fn("SessionRepository.make")(function* () {
  const {globalState, window} = yield* VsCodeApi;
  const initialSessions = yield* loadInitialSessions(globalState);
  const sessions: SessionsReference = yield* SubscriptionRef.make(initialSessions);
  yield* Effect.forkScoped(
    Stream.runForEach(fromEvent(window.onDidChangeWindowState), (windowState) =>
      reloadSessionsOnFocus(globalState, sessions, windowState)
    )
  );

  return {
    modifySessions: <ChangeResult>(changeSessions: ChangeSessions<ChangeResult>) =>
      modifySessions(globalState, sessions, changeSessions),
    sessions
  };
});

// globalState is the source of truth, shared by every window; `sessions` is this window's copy for the view.
export const SessionRepository = Layer.effect(ISessionRepository, makeSessionRepository());
