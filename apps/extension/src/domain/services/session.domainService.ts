import {Array, Effect} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";

interface UnreadSessionIdsInputs {
  readonly currentStatuses: ReadonlyMap<SessionIdValueObject, StatusValueObject>;
  readonly previousStatuses: ReadonlyMap<SessionIdValueObject, StatusValueObject>;
  readonly previousUnreadSessionIds: ReadonlySet<SessionIdValueObject>;
  readonly viewedSessionId: SessionIdValueObject | undefined;
}

// The rules that span several sessions.

// A turn is in progress while its session runs or waits on the user.
const TURN_IN_PROGRESS_STATUSES: ReadonlySet<StatusValueObject | undefined> = new Set(["needs-input", "running"]);

// Lowest free "<project> #n", so removing #1 frees the name for the next session.
export const getNewSessionName = Effect.fn("SessionDomainService.getNewSessionName")(function* (
  projectName: string,
  existingSessions: readonly SessionEntity[]
) {
  const takenSessionNames = new Set(Array.map(existingSessions, (session) => session.name));
  let sessionNumber = 1;
  while (takenSessionNames.has(`${projectName} #${sessionNumber}`)) sessionNumber += 1;

  return `${projectName} #${sessionNumber}`;
});

// A turn that ends while its session is out of view leaves it unread until it comes into view or starts another turn.
// Ended means idle now, and running or waiting on the user at the previous look.
export const getUnreadSessionIds = Effect.fn("SessionDomainService.getUnreadSessionIds")(function* (
  inputs: UnreadSessionIdsInputs
) {
  const {currentStatuses, previousStatuses, previousUnreadSessionIds, viewedSessionId} = inputs;
  const endedSessionIds = Array.map(
    Array.filter(
      [...currentStatuses],
      ([sessionId, sessionStatus]) =>
        sessionStatus === "idle" && TURN_IN_PROGRESS_STATUSES.has(previousStatuses.get(sessionId))
    ),
    ([sessionId]) => sessionId
  );
  const isIdleAndOutOfView = (sessionId: SessionIdValueObject) =>
    currentStatuses.get(sessionId) === "idle" && sessionId !== viewedSessionId;
  const unreadSessionIds: ReadonlySet<SessionIdValueObject> = new Set(
    Array.filter([...previousUnreadSessionIds, ...endedSessionIds], isIdleAndOutOfView)
  );

  return unreadSessionIds;
});
