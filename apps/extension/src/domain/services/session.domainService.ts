import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {LaunchPlanValueObjectSchema} from "@valueObjects/launchPlan.valueObject.ts";
import {SESSION_STATUSES} from "@valueObjects/sessionStatus.valueObject.ts";
import {Array, DateTime, Effect, Predicate, Result, Schema, String} from "effect";

import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {AgentStatusValueObject} from "@valueObjects/agentStatus.valueObject.ts";
import type {SessionStatusValueObject} from "@valueObjects/sessionStatus.valueObject.ts";

interface SessionViewingFacts {
  readonly isAgentRunning: boolean;
  readonly isInView: boolean;
}

// The agent resumes with the agent's own id for the conversation, which the agent never showed.
export class AgentSessionIdNotFoundError extends Schema.TaggedError<
  AgentSessionIdNotFoundError,
  {readonly brand: unique symbol}
>()("AgentSessionIdNotFoundError", {agentName: Schema.String}) {}

export class SessionNamedByUserError extends Schema.TaggedError<
  SessionNamedByUserError,
  {readonly brand: unique symbol}
>()("SessionNamedByUserError", {}) {}

// The titles hold only status marks or an id, or the agent has not named the conversation.
export class SessionTitleNotFoundError extends Schema.TaggedError<
  SessionTitleNotFoundError,
  {readonly brand: unique symbol}
>()("SessionTitleNotFoundError", {}) {}

export class SessionTitleUnchangedError extends Schema.TaggedError<
  SessionTitleUnchangedError,
  {readonly brand: unique symbol}
>()("SessionTitleUnchangedError", {}) {}

// Agents put status marks (Claude's ✳, Codex's ⠋, emoji) around the title; Unicode classes keep every language.
const STATUS_MARKS_AT_ENDS = /^[\p{C}\p{S}\p{Z}]+|[\p{C}\p{S}\p{Z}]+$/gu;

// Some agents show their session's id until it has a title: a UUID, maybe with a prefix such as OpenCode's ses_.
const ID_ONLY_TITLE = /^(?:[a-z]+_)?(?=[\da-f-]*\d)[\da-f-]{16,}$/iu;

// OpenCode names a conversation by its start time until it has a title: "New session - 2026-11-09T09:26:37.754Z".
const START_TIME_TITLE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u;

const REGEX_SYNTAX_CHARACTERS = /[$()*+./?[\\\]^{|}]/gu;

const SESSION_ID_VARIABLE = `\${sessionId}`;
const AGENT_SESSION_ID_VARIABLE = `\${agentSessionId}`;

const fillInVariables = Effect.fn("SessionDomainService.fillInVariables")(function* (
  agentArgument: string,
  agent: AgentEntity,
  session: SessionEntity
) {
  const filledInArgument = String.replaceAll(SESSION_ID_VARIABLE, session.id)(agentArgument);
  if (!String.includes(AGENT_SESSION_ID_VARIABLE)(filledInArgument)) return filledInArgument;
  if (session.agentSessionId === undefined) return yield* AgentSessionIdNotFoundError.make({agentName: agent.name});

  return String.replaceAll(AGENT_SESSION_ID_VARIABLE, session.agentSessionId)(filledInArgument);
});

export const prepareLaunchPlan = Effect.fn("SessionDomainService.prepareLaunchPlan")(function* (
  agent: AgentEntity,
  session: SessionEntity
) {
  const agentArguments = session.hasWorked ? agent.resumeArgs : agent.args;

  return LaunchPlanValueObjectSchema.make({
    command: agent.command,
    commandArguments: yield* Effect.forEach(agentArguments, (agentArgument) =>
      fillInVariables(agentArgument, agent, session)
    ),
    environmentVariables: agent.environmentVariables
  });
});

// Agents add their name, command or the project folder to the title: "<title> - GitHub Copilot", "<title> | <folder>".
const dropNamesAtEnds = Effect.fn("SessionDomainService.dropNamesAtEnds")(function* (
  title: string,
  names: readonly string[]
) {
  return Array.reduce(names, title, (remainingTitle, name) => {
    const nameAsText = String.replaceAll(REGEX_SYNTAX_CHARACTERS, "\\$&")(name);
    const nameAtEnds = new RegExp(`^${nameAsText}\\s*[-|:]\\s*|\\s*[-|:]\\s*${nameAsText}$`, "giu");

    return String.replace(nameAtEnds, "")(remainingTitle);
  });
});

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

export const getSessionTitle = Effect.fn("SessionDomainService.getSessionTitle")(function* (
  session: SessionEntity,
  agent: AgentEntity,
  projectName: string
) {
  const names = [agent.name, agent.command, projectName];
  const lowercaseNames = new Set(Array.map(names, String.toLowerCase));
  const agentTitles = Array.filter([session.reportedTitle, session.terminalTitle], Predicate.isNotUndefined);
  const cleanedTitles = yield* Effect.forEach(agentTitles, (agentTitle) =>
    Effect.map(
      dropNamesAtEnds(String.replace(STATUS_MARKS_AT_ENDS, "")(agentTitle), names),
      String.replace(STATUS_MARKS_AT_ENDS, "")
    )
  );
  const sessionTitle = Array.findFirst(
    cleanedTitles,
    (title) =>
      title !== "" &&
      !lowercaseNames.has(String.toLowerCase(title)) &&
      !ID_ONLY_TITLE.test(title) &&
      !START_TIME_TITLE.test(title)
  );

  return yield* Effect.fromResult(Result.fromOption(sessionTitle, () => SessionTitleNotFoundError.make()));
});

// Saved as the session's name, so the row keeps it while the agent is gone or resuming.
export const getSessionTitleToSave = Effect.fn("SessionDomainService.getSessionTitleToSave")(function* (
  session: SessionEntity,
  agent: AgentEntity,
  projectName: string
) {
  if (session.customName !== undefined) return yield* SessionNamedByUserError.make();
  const sessionTitle = yield* getSessionTitle(session, agent, projectName);
  if (sessionTitle === session.name) return yield* SessionTitleUnchangedError.make();

  return sessionTitle;
});

const isFinishedTurnUnseen = Effect.fn("SessionDomainService.isFinishedTurnUnseen")(function* (
  session: SessionEntity,
  isInView: boolean
) {
  if (isInView || session.statusChangedAt === undefined) return false;

  return session.viewedAt === undefined || DateTime.isGreaterThan(session.statusChangedAt, session.viewedAt);
});

// No process means the agent is gone, even after a reboot; no report yet shows idle, so the row never looks stuck.
export const getSessionStatus = Effect.fn("SessionDomainService.getSessionStatus")(function* (
  session: SessionEntity,
  sessionViewingFacts: SessionViewingFacts
) {
  if (!sessionViewingFacts.isAgentRunning) return SESSION_STATUSES.EXITED;
  if (session.status === AGENT_STATUSES.UNKNOWN) return SESSION_STATUSES.IDLE;
  if (session.status === AGENT_STATUSES.DONE && !(yield* isFinishedTurnUnseen(session, sessionViewingFacts.isInView)))
    return SESSION_STATUSES.IDLE;

  return session.status;
});

export const isSessionTurnRunning = Effect.fn("SessionDomainService.isSessionTurnRunning")(function* (
  sessionStatus: SessionStatusValueObject
) {
  return sessionStatus === SESSION_STATUSES.WORKING || sessionStatus === SESSION_STATUSES.BLOCKED;
});

// Agents that end a turn with idle rather than done (OpenCode) have finished when they go from working back to idle.
export const getAlertedStatus = Effect.fn("SessionDomainService.getAlertedStatus")(function* (
  heldStatus: AgentStatusValueObject,
  previousHeldStatus: AgentStatusValueObject | undefined
) {
  if (heldStatus === AGENT_STATUSES.IDLE && previousHeldStatus === AGENT_STATUSES.WORKING) return AGENT_STATUSES.DONE;

  return heldStatus;
});

export const isSessionWaitingOnUser = Effect.fn("SessionDomainService.isSessionWaitingOnUser")(function* (
  sessionStatus: SessionStatusValueObject
) {
  return (
    sessionStatus === SESSION_STATUSES.BLOCKED ||
    sessionStatus === SESSION_STATUSES.ERROR ||
    sessionStatus === SESSION_STATUSES.DONE
  );
});
