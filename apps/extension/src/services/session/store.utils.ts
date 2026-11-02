import {SessionNotFound} from "@/errors/session.error.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {Effect, Result, SubscriptionRef} from "effect";

import type {Repo} from "@/services/repo/repo.service.ts";
import type {Session} from "@/services/session/store.service.ts";

// Lowest free "<repo> #n", so removing #1 frees the name for the next session.
const getLowestFreeSessionName = (repo: Repo, allSessions: readonly Session[]) => {
  const takenSessionNames = new Set(allSessions.map((session) => session.name));
  let sessionNumber = 1;
  while (takenSessionNames.has(`${repo.name} #${sessionNumber}`)) sessionNumber += 1;

  return `${repo.name} #${sessionNumber}`;
};

// Read-modify-write against globalState under the ref's permit, so a change never drops what another window saved.
const modifyStoredSessions = Effect.fn("modifyStoredSessions")(function* <ChangeResult>(
  changeSessions: (storedSessions: readonly Session[]) => readonly [ChangeResult, readonly Session[]]
) {
  const {loadSessions, saveSessions, sessions} = yield* SessionStore;

  const writeSessionsChange = Effect.fn("writeSessionsChange")(function* () {
    const [changeResult, nextSessions] = changeSessions(yield* loadSessions);
    yield* saveSessions(nextSessions);

    return [changeResult, nextSessions] as const;
  });

  return yield* SubscriptionRef.modifyEffect(sessions, () => writeSessionsChange());
});

export const listSessions = Effect.fn("listSessions")(function* () {
  const {sessions} = yield* SessionStore;

  return yield* SubscriptionRef.get(sessions);
});

export const findSession = Effect.fn("findSession")(function* (sessionId: string) {
  const allSessions = yield* listSessions();

  return yield* Effect.fromResult(
    Result.fromNullishOr(
      allSessions.find((session) => session.id === sessionId),
      () => new SessionNotFound({sessionId})
    )
  );
});

export const addSession = Effect.fn("addSession")(function* (repo: Repo) {
  const sessionId = yield* Effect.sync(() => crypto.randomUUID());

  return yield* modifyStoredSessions((storedSessions) => {
    const addedSession: Session = {
      cwd: repo.path,
      id: sessionId,
      name: getLowestFreeSessionName(repo, storedSessions)
    };

    return [addedSession, [...storedSessions, addedSession]] as const;
  });
});

export const deleteSession = Effect.fn("deleteSession")(function* (sessionId: string) {
  yield* modifyStoredSessions(
    (storedSessions) => [sessionId, storedSessions.filter((session) => session.id !== sessionId)] as const
  );
});
