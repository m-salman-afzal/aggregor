import {Array, Effect, Schema, String} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";

interface UnreadSessionIdsInputs {
  readonly currentStatuses: ReadonlyMap<EntityIdValueObject, StatusValueObject>;
  readonly previousStatuses: ReadonlyMap<EntityIdValueObject, StatusValueObject>;
  readonly previousUnreadSessionIds: ReadonlySet<EntityIdValueObject>;
  readonly viewedSessionId: EntityIdValueObject | undefined;
}

// The terminal title carries no session title: it holds only status marks, or the agent has not named the conversation.
export class SessionTitleNotFoundError extends Schema.TaggedError<
  SessionTitleNotFoundError,
  {readonly brand: unique symbol}
>()("SessionTitleNotFoundError", {}) {}

// The rules that span several sessions.

// Agents put their status marks (Claude's ✳, Codex's ⠋, emoji) before the title, as symbols, so the title starts at the
// first character that is not a symbol, space or control character. Matching Unicode classes keeps every language.
const LEADING_STATUS_MARKS = /^[\p{C}\p{S}\p{Z}]+/u;

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

// The session's title in the title its agent gives the terminal, without the agent's leading status marks. One of the
// agent's placeholder titles, shown before it names the conversation, is no title.
export const getSessionTitle = Effect.fn("SessionDomainService.getSessionTitle")(function* (
  terminalTitle: string,
  placeholderTitles: ReadonlySet<string>
) {
  const sessionTitle = String.trim(String.replace(LEADING_STATUS_MARKS, "")(terminalTitle));
  if (sessionTitle === "" || placeholderTitles.has(sessionTitle)) return yield* SessionTitleNotFoundError.make();

  return sessionTitle;
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
  const isIdleAndOutOfView = (sessionId: EntityIdValueObject) =>
    currentStatuses.get(sessionId) === "idle" && sessionId !== viewedSessionId;
  const unreadSessionIds: ReadonlySet<EntityIdValueObject> = new Set(
    Array.filter([...previousUnreadSessionIds, ...endedSessionIds], isIdleAndOutOfView)
  );

  return unreadSessionIds;
});
