import {Array, Effect, Predicate, Result, Schema, String} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";

interface UnreadSessionIdsInputs {
  readonly currentStatuses: ReadonlyMap<EntityIdValueObject, StatusValueObject>;
  readonly previousStatuses: ReadonlyMap<EntityIdValueObject, StatusValueObject>;
  readonly previousUnreadSessionIds: ReadonlySet<EntityIdValueObject>;
  readonly viewedSessionId: EntityIdValueObject | undefined;
}

// The agent's titles carry no session title: they hold only status marks or an id, or it has not named the conversation.
export class SessionTitleNotFoundError extends Schema.TaggedError<
  SessionTitleNotFoundError,
  {readonly brand: unique symbol}
>()("SessionTitleNotFoundError", {}) {}

// The rules that span several sessions.

// Agents put status marks (Claude's ✳, Codex's ⠋, emoji) around the title, as symbols, so the title runs from the first
// character that is not a symbol, space or control character to the last. Matching Unicode classes keeps every language.
const STATUS_MARKS_AT_ENDS = /^[\p{C}\p{S}\p{Z}]+|[\p{C}\p{S}\p{Z}]+$/gu;

// Some agents show their session's id until it has a title: a UUID, maybe with a prefix such as OpenCode's ses_.
const ID_ONLY_TITLE = /^(?:[a-z]+_)?(?=[\da-f-]*\d)[\da-f-]{16,}$/iu;

// A turn is in progress while its agent works or waits on the user.
const TURN_IN_PROGRESS_STATUSES: ReadonlySet<StatusValueObject | undefined> = new Set(["blocked", "working"]);

// A turn has ended once its agent says done, or goes straight back to idle as Codex and OpenCode do.
const TURN_ENDED_STATUSES: ReadonlySet<StatusValueObject | undefined> = new Set(["done", "idle"]);

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

// The session's title from what its agent reports: the title in its OSC 7501 report first, else its window title, without
// status marks. A placeholder, an id or nothing at all is no title.
export const getSessionTitle = Effect.fn("SessionDomainService.getSessionTitle")(function* (
  session: SessionEntity,
  placeholderTitles: ReadonlySet<string>
) {
  const agentTitles = Array.filter([session.reportedTitle, session.terminalTitle], Predicate.isNotUndefined);
  const sessionTitle = Array.findFirst(
    Array.map(agentTitles, String.replace(STATUS_MARKS_AT_ENDS, "")),
    (title) => title !== "" && !placeholderTitles.has(title) && !ID_ONLY_TITLE.test(title)
  );

  return yield* Effect.fromResult(Result.fromOption(sessionTitle, () => SessionTitleNotFoundError.make()));
});

// A turn that ends while its session is out of view leaves it unread until it comes into view or starts another turn.
// Ended means done or idle now, and working or waiting on the user at the previous look.
export const getUnreadSessionIds = Effect.fn("SessionDomainService.getUnreadSessionIds")(function* (
  inputs: UnreadSessionIdsInputs
) {
  const {currentStatuses, previousStatuses, previousUnreadSessionIds, viewedSessionId} = inputs;
  const endedSessionIds = Array.map(
    Array.filter(
      [...currentStatuses],
      ([sessionId, sessionStatus]) =>
        TURN_ENDED_STATUSES.has(sessionStatus) && TURN_IN_PROGRESS_STATUSES.has(previousStatuses.get(sessionId))
    ),
    ([sessionId]) => sessionId
  );
  const isEndedAndOutOfView = (sessionId: EntityIdValueObject) =>
    TURN_ENDED_STATUSES.has(currentStatuses.get(sessionId)) && sessionId !== viewedSessionId;
  const unreadSessionIds: ReadonlySet<EntityIdValueObject> = new Set(
    Array.filter([...previousUnreadSessionIds, ...endedSessionIds], isEndedAndOutOfView)
  );

  return unreadSessionIds;
});
