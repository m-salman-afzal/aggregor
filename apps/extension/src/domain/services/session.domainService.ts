import {Array, DateTime, Effect, Predicate, Result, Schema, String} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionStatusValueObject} from "@valueObjects/sessionStatus.valueObject.ts";

// What a session's status depends on besides the session: whether this window has its terminal, and whether the user
// is looking at it.
interface SessionViewingFacts {
  readonly hasOpenTerminal: boolean;
  readonly isInView: boolean;
}

// The user named the session, so the agent's title doesn't replace that name.
export class SessionNamedByUserError extends Schema.TaggedError<
  SessionNamedByUserError,
  {readonly brand: unique symbol}
>()("SessionNamedByUserError", {}) {}

// The agent's titles carry no session title: they hold only status marks or an id, or it has not named the conversation.
export class SessionTitleNotFoundError extends Schema.TaggedError<
  SessionTitleNotFoundError,
  {readonly brand: unique symbol}
>()("SessionTitleNotFoundError", {}) {}

// The session's name already is the agent's latest title.
export class SessionTitleUnchangedError extends Schema.TaggedError<
  SessionTitleUnchangedError,
  {readonly brand: unique symbol}
>()("SessionTitleUnchangedError", {}) {}

// The rules about sessions: their names and titles, and the status the user sees.

// Agents put status marks (Claude's ✳, Codex's ⠋, emoji) around the title, as symbols, so the title runs from the first
// character that is not a symbol, space or control character to the last. Matching Unicode classes keeps every language.
const STATUS_MARKS_AT_ENDS = /^[\p{C}\p{S}\p{Z}]+|[\p{C}\p{S}\p{Z}]+$/gu;

// Some agents show their session's id until it has a title: a UUID, maybe with a prefix such as OpenCode's ses_.
const ID_ONLY_TITLE = /^(?:[a-z]+_)?(?=[\da-f-]*\d)[\da-f-]{16,}$/iu;

// The lowest free "<project> #n", so removing #1 frees the name for the next session.
export const getDefaultSessionName = Effect.fn("SessionDomainService.getDefaultSessionName")(function* (
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

// The agent's title becomes the session's name, so the row keeps it while the agent is gone or resuming; a name the user
// gave wins.
export const getSessionTitleToSave = Effect.fn("SessionDomainService.getSessionTitleToSave")(function* (
  session: SessionEntity,
  placeholderTitles: ReadonlySet<string>
) {
  if (session.customName !== undefined) return yield* SessionNamedByUserError.make();
  const sessionTitle = yield* getSessionTitle(session, placeholderTitles);
  if (sessionTitle === session.name) return yield* SessionTitleUnchangedError.make();

  return sessionTitle;
});

// A finished turn stays unseen while the session is out of view, until it comes into or leaves view after the agent
// said done.
const isFinishedTurnUnseen = Effect.fn("SessionDomainService.isFinishedTurnUnseen")(function* (
  session: SessionEntity,
  isInView: boolean
) {
  const {statusChangedAt, viewedAt} = session;
  if (isInView || statusChangedAt === undefined) return false;

  return viewedAt === undefined || DateTime.isGreaterThan(statusChangedAt, viewedAt);
});

// Without a terminal in this window the agent is gone, even one that could not say so. No report yet, as from an agent
// that never reports, shows idle, so the row never looks stuck. A finished turn shows done until the user has seen it.
export const getSessionStatus = Effect.fn("SessionDomainService.getSessionStatus")(function* (
  session: SessionEntity,
  {hasOpenTerminal, isInView}: SessionViewingFacts
) {
  if (!hasOpenTerminal) return "exited" satisfies SessionStatusValueObject;
  if (session.status === "unknown") return "idle" satisfies SessionStatusValueObject;
  if (session.status === "done" && !(yield* isFinishedTurnUnseen(session, isInView)))
    return "idle" satisfies SessionStatusValueObject;

  return session.status;
});

// The kind of wait and the progress apply only while the agent is at its turn.
export const isSessionTurnRunning = Effect.fn("SessionDomainService.isSessionTurnRunning")(function* (
  sessionStatus: SessionStatusValueObject
) {
  return sessionStatus === "working" || sessionStatus === "blocked";
});
