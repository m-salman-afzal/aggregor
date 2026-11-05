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
import {Effect, Layer, Schema, Stream, SubscriptionRef} from "effect";

import type {Memento, WindowState} from "vscode";

type ChangeSessions<ChangeResult> = (
  storedSessions: readonly SessionEntity[]
) => readonly [ChangeResult, readonly SessionEntity[]];

// This window's copy of the stored sessions, which the view renders from.
type SessionsReference = SubscriptionRef.SubscriptionRef<readonly SessionEntity[]>;

// Re-reads globalState on every call.
const loadSessions = Effect.fn("SessionRepository.loadSessions")(
  function* (globalState: Memento) {
    const storedValue = yield* Effect.sync(() =>
      globalState.get<unknown>(STORAGE_KEYS.SAVED_SESSIONS, NO_STORED_SESSIONS)
    );
    const storedSessions = yield* Schema.decodeUnknownEffect(StoredSessionsModel)(storedValue);

    return storedSessions.sessions.map((storedSession) => new SessionEntity(storedSession));
  },
  Effect.mapError((cause) => new SessionsCorruptError({cause}))
);

const saveSessions = Effect.fn("SessionRepository.saveSessions")(
  function* (globalState: Memento, sessions: readonly SessionEntity[]) {
    const storedValue = yield* Schema.encodeEffect(StoredSessionsModel)({sessions, version: 1});

    yield* Effect.tryPromise(async () => globalState.update(STORAGE_KEYS.SAVED_SESSIONS, storedValue));
  },
  Effect.mapError((cause) => new SessionsSaveFailedError({cause}))
);

const writeSessionsChange = Effect.fn("SessionRepository.writeSessionsChange")(function* <ChangeResult>(
  globalState: Memento,
  changeSessions: ChangeSessions<ChangeResult>
) {
  const [changeResult, nextSessions] = changeSessions(yield* loadSessions(globalState));
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
  const sessions: SessionsReference = yield* SubscriptionRef.make(yield* loadInitialSessions(globalState));
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
