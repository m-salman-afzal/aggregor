import {getNewSessionName, Session} from "@/domain/entities/session/session.entity.ts";
import {SessionRepository} from "@/domain/entities/session/session.repository.ts";
import {SessionNotFound} from "@/domain/errors/session.error.ts";
import {SessionIdSchema} from "@/domain/value-objects/session-id.value-object.ts";
import {Effect, Result, SubscriptionRef} from "effect";

import type {Repo} from "@/domain/entities/repo/repo.entity.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

export const listSessions = Effect.fn("listSessions")(function* () {
  const {sessions} = yield* SessionRepository;

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
  const {modifySessions} = yield* SessionRepository;
  const sessionId = yield* Effect.sync(() => SessionIdSchema.make(crypto.randomUUID()));

  return yield* modifySessions((storedSessions) => {
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
  const {modifySessions} = yield* SessionRepository;
  yield* modifySessions(
    (storedSessions) => [sessionId, storedSessions.filter((session) => session.id !== sessionId)] as const
  );
});
