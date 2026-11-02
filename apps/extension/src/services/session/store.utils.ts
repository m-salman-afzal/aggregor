import {getNewSessionName, Session} from "@/domain/entities/session/session.entity.ts";
import {SessionNotFound} from "@/domain/errors/session.error.ts";
import {SessionIdSchema} from "@/domain/value-objects/session-id.value-object.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {Effect, Result, SubscriptionRef} from "effect";

import type {Repo} from "@/domain/entities/repo/repo.entity.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

// Read-modify-write against globalState under the ref's permit, so a change never drops what another window saved.
const modifyStoredSessions = Effect.fn("modifyStoredSessions")(function* <ChangeResult>(
  changeSessions: (storedSessions: readonly Session[]) => readonly [ChangeResult, readonly Session[]]
) {
  const {loadSessions, saveSessions, sessions} = yield* SessionStore;

  const writeSessionsChange = Effect.fn("writeSessionsChange")(function* () {
    const [changeResult, nextSessions] = changeSessions(yield* loadSessions());
    yield* saveSessions(nextSessions);

    return [changeResult, nextSessions] as const;
  });

  return yield* SubscriptionRef.modifyEffect(sessions, () => writeSessionsChange());
});

export const listSessions = Effect.fn("listSessions")(function* () {
  const {sessions} = yield* SessionStore;

  return yield* SubscriptionRef.get(sessions);
});

export const findSession = Effect.fn("findSession")(function* (sessionId: SessionId) {
  const allSessions = yield* listSessions();

  return yield* Effect.fromResult(
    Result.fromNullishOr(
      allSessions.find((session) => session.id === sessionId),
      () => new SessionNotFound({sessionId})
    )
  );
});

export const addSession = Effect.fn("addSession")(function* (repo: Repo) {
  const sessionId = yield* Effect.sync(() => SessionIdSchema.make(crypto.randomUUID()));

  return yield* modifyStoredSessions((storedSessions) => {
    const addedSession = new Session({
      harnessId: "claude-code",
      id: sessionId,
      name: getNewSessionName(repo.name, storedSessions),
      repoPath: repo.path
    });

    return [addedSession, [...storedSessions, addedSession]] as const;
  });
});

export const deleteSession = Effect.fn("deleteSession")(function* (sessionId: SessionId) {
  yield* modifyStoredSessions(
    (storedSessions) => [sessionId, storedSessions.filter((session) => session.id !== sessionId)] as const
  );
});
