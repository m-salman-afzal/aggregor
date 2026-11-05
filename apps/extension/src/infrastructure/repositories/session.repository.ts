import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {Session} from "@/domain/entities/session/session.entity.ts";
import {SessionRepository} from "@/domain/entities/session/session.repository.ts";
import {SessionsCorrupt, SessionsSaveFailed} from "@/domain/errors/session.error.ts";
import {NO_STORED_SESSIONS, StoredSessions} from "@/infrastructure/database/models/stored-sessions.model.ts";
import {fromEvent} from "@/infrastructure/utils/vscode.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Layer, Schema, Stream, SubscriptionRef} from "effect";

import type {Memento, WindowState} from "vscode";

type ChangeSessions<ChangeResult> = (storedSessions: readonly Session[]) => readonly [ChangeResult, readonly Session[]];

// This window's copy of the stored sessions, which the view renders from.
type SessionsReference = SubscriptionRef.SubscriptionRef<readonly Session[]>;

// Re-reads globalState on every call.
const loadSessions = Effect.fn("SessionRepository.loadSessions")(
  function* (globalState: Memento) {
    const storedValue = yield* Effect.sync(() =>
      globalState.get<unknown>(STORAGE_KEYS.STORED_SESSIONS, NO_STORED_SESSIONS)
    );
    const storedSessions = yield* Schema.decodeUnknownEffect(StoredSessions)(storedValue);

    return storedSessions.sessions.map((storedSession) => new Session(storedSession));
  },
  Effect.mapError((cause) => new SessionsCorrupt({cause}))
);

const saveSessions = Effect.fn("SessionRepository.saveSessions")(
  function* (globalState: Memento, sessions: readonly Session[]) {
    const storedValue = yield* Schema.encodeEffect(StoredSessions)({sessions, version: 1});

    yield* Effect.tryPromise(async () => globalState.update(STORAGE_KEYS.STORED_SESSIONS, storedValue));
  },
  Effect.mapError((cause) => new SessionsSaveFailed({cause}))
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
  const noSessions: readonly Session[] = [];

  return noSessions;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialSessions = Effect.fn("SessionRepository.loadInitialSessions")(
  function* (globalState: Memento) {
    return yield* loadSessions(globalState);
  },
  Effect.catchTag("SessionsCorrupt", () => showUnreadableSessionsError())
);

// Other windows write to the same globalState; pick up their changes when this window comes back into focus.
const reloadSessionsOnFocus = Effect.fn("SessionRepository.reloadSessionsOnFocus")(
  function* (globalState: Memento, sessions: SessionsReference, windowState: WindowState) {
    if (!windowState.focused) return;

    yield* SubscriptionRef.updateEffect(sessions, () => loadSessions(globalState));
  },
  Effect.catchTag("SessionsCorrupt", (sessionsCorrupt) =>
    Effect.andThen(Effect.logError(SESSION_MESSAGES.UNREADABLE, sessionsCorrupt.cause), showUnreadableSessionsError())
  )
);

const makeSessionRepositoryOnGlobalState = Effect.fn("SessionRepository.make")(function* () {
  const {globalState, window} = yield* VsCodeService;
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
export const SessionRepositoryOnGlobalState = Layer.effect(SessionRepository, makeSessionRepositoryOnGlobalState());
