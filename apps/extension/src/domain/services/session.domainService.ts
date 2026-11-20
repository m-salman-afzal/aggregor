import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {AGENT_TASK_STATES} from "@valueObjects/agentTaskState.valueObject.ts";
import {LaunchPlanValueObjectSchema} from "@valueObjects/launchPlan.valueObject.ts";
import {SESSION_RUN_STATES} from "@valueObjects/sessionRunState.valueObject.ts";
import {SESSION_STATUSES} from "@valueObjects/sessionStatus.valueObject.ts";
import {Array, Context, DateTime, Effect, Layer, Predicate, Result, Schema, String} from "effect";

import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {AgentStatusValueObject} from "@valueObjects/agentStatus.valueObject.ts";
import type {SessionStatusValueObject} from "@valueObjects/sessionStatus.valueObject.ts";

interface SessionViewingFacts {
  readonly isAgentRunning: boolean;
  readonly isInView: boolean;
}

export class SessionDomainServiceErrors extends TaggedErrors({
  AgentConversationIdNotFoundError: {agentName: Schema.String},
  AgentSessionIdNotFoundError: {agentName: Schema.String},
  SessionNamedByUserError: {},
  SessionTitleNotFoundError: {},
  SessionTitleUnchangedError: {}
}) {}

// Agents put status marks (Claude's ✳, Codex's ⠋, emoji) around the title; Unicode classes keep every language.
const STATUS_MARKS_AT_ENDS = /^[\p{C}\p{S}\p{Z}]+|[\p{C}\p{S}\p{Z}]+$/gu;

// Some agents show their session's id until it has a title: a UUID, maybe with a prefix such as OpenCode's ses_.
const ID_ONLY_TITLE = /^(?:[a-z]+_)?(?=[\da-f-]*\d)[\da-f-]{16,}$/iu;

// OpenCode names a conversation by its start time until it has a title: "New session - 2026-11-09T09:26:37.754Z".
const START_TIME_TITLE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u;

const REGEX_SYNTAX_CHARACTERS = /[$()*+./?[\\\]^{|}]/gu;

const SESSION_ID_VARIABLE = `\${sessionId}`;
const AGENT_SESSION_ID_VARIABLE = `\${agentSessionId}`;

export class SessionDomainService extends Context.Service<SessionDomainService>()(
  "aggregor-app/domain/services/session.domainService/SessionDomainService",
  {
    make: Effect.fn("make")(function* () {
      const fillInVariables = Effect.fn("fillInVariables")(function* (
        agentArgument: string,
        agent: AgentEntity,
        session: SessionEntity
      ) {
        const filledInArgument = String.replaceAll(SESSION_ID_VARIABLE, session.conversationId)(agentArgument);
        if (!String.includes(AGENT_SESSION_ID_VARIABLE)(filledInArgument)) return filledInArgument;
        const latestAgentSessionId = session.latestAgentSessionId;
        if (latestAgentSessionId === undefined)
          return yield* SessionDomainServiceErrors.AgentSessionIdNotFoundError.make({agentName: agent.name});

        return String.replaceAll(AGENT_SESSION_ID_VARIABLE, latestAgentSessionId)(filledInArgument);
      });

      const getAgentConversationId = Effect.fn("getAgentConversationId")(function* (
        agent: AgentEntity,
        session: SessionEntity
      ) {
        const conversationIdArgument = Array.findFirst(
          agent.resumeArgs,
          (resumeArgument) =>
            String.includes(SESSION_ID_VARIABLE)(resumeArgument) ||
            String.includes(AGENT_SESSION_ID_VARIABLE)(resumeArgument)
        );
        const resumeArgument = yield* Effect.fromResult(
          Result.fromOption(conversationIdArgument, () =>
            SessionDomainServiceErrors.AgentConversationIdNotFoundError.make({agentName: agent.name})
          )
        );

        return yield* fillInVariables(resumeArgument, agent, session);
      });

      const prepareLaunchPlan = Effect.fn("prepareLaunchPlan")(function* (agent: AgentEntity, session: SessionEntity) {
        const agentArguments = session.hasConversation ? agent.resumeArgs : agent.args;

        return LaunchPlanValueObjectSchema.make({
          command: agent.command,
          commandArguments: yield* Effect.forEach(agentArguments, (agentArgument) =>
            fillInVariables(agentArgument, agent, session)
          ),
          environmentVariables: agent.environmentVariables
        });
      });

      // Agents add their name, command or the project folder to the title: "<title> - GitHub Copilot", "<title> | <folder>".
      const dropNamesAtEnds = Effect.fn("dropNamesAtEnds")(function* (title: string, names: readonly string[]) {
        return Array.reduce(names, title, (remainingTitle, name) => {
          const nameAsText = String.replaceAll(REGEX_SYNTAX_CHARACTERS, "\\$&")(name);
          const nameAtEnds = new RegExp(`^${nameAsText}\\s*[-|:]\\s*|\\s*[-|:]\\s*${nameAsText}$`, "giu");

          return String.replace(nameAtEnds, "")(remainingTitle);
        });
      });

      const getDefaultSessionName = Effect.fn("getDefaultSessionName")(function* (
        projectName: string,
        existingSessions: readonly SessionEntity[]
      ) {
        const takenSessionNames = new Set(Array.map(existingSessions, (session) => session.name));
        let sessionNumber = 1;
        while (takenSessionNames.has(`${projectName} #${sessionNumber}`)) sessionNumber += 1;

        return `${projectName} #${sessionNumber}`;
      });

      const getSessionTitle = Effect.fn("getSessionTitle")(function* (
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

        return yield* Effect.fromResult(
          Result.fromOption(sessionTitle, () => SessionDomainServiceErrors.SessionTitleNotFoundError.make())
        );
      });

      const getSessionTitleToSave = Effect.fn("getSessionTitleToSave")(function* (
        session: SessionEntity,
        agent: AgentEntity,
        projectName: string
      ) {
        if (session.customName !== undefined) return yield* SessionDomainServiceErrors.SessionNamedByUserError.make();
        const sessionTitle = yield* getSessionTitle(session, agent, projectName);
        if (sessionTitle === session.name) return yield* SessionDomainServiceErrors.SessionTitleUnchangedError.make();

        return sessionTitle;
      });

      const isFinishedTurnUnseen = Effect.fn("isFinishedTurnUnseen")(function* (
        session: SessionEntity,
        isInView: boolean
      ) {
        if (isInView || session.statusChangedAt === undefined) return false;

        return session.viewedAt === undefined || DateTime.isGreaterThan(session.statusChangedAt, session.viewedAt);
      });

      // OpenCode reports its own conversation again as a task, with the title it reports for itself.
      const getSessionTasks = Effect.fn("getSessionTasks")(function* (session: SessionEntity) {
        return Array.filter(
          session.tasks,
          (agentTask) => agentTask.title === undefined || agentTask.title !== session.reportedTitle
        );
      });

      // A sub-agent can work on after the agent's own turn has ended, which keeps the row working.
      const hasWorkingTask = Effect.fn("hasWorkingTask")(function* (session: SessionEntity) {
        const sessionTasks = yield* getSessionTasks(session);

        return Array.some(sessionTasks, (agentTask) => agentTask.state === AGENT_TASK_STATES.WORKING);
      });

      const getSessionStatus = Effect.fn("getSessionStatus")(function* (
        session: SessionEntity,
        sessionViewingFacts: SessionViewingFacts
      ) {
        if (!sessionViewingFacts.isAgentRunning)
          return session.runState === SESSION_RUN_STATES.INTERRUPTED
            ? SESSION_STATUSES.INTERRUPTED
            : SESSION_STATUSES.EXITED;
        if (session.status !== AGENT_STATUSES.BLOCKED && (yield* hasWorkingTask(session)))
          return SESSION_STATUSES.WORKING;
        if (session.status === AGENT_STATUSES.UNKNOWN) return SESSION_STATUSES.IDLE;
        if (
          session.status === AGENT_STATUSES.DONE &&
          !(yield* isFinishedTurnUnseen(session, sessionViewingFacts.isInView))
        )
          return SESSION_STATUSES.IDLE;

        return session.status;
      });

      const isSessionTurnRunning = Effect.fn("isSessionTurnRunning")(function* (
        sessionStatus: SessionStatusValueObject
      ) {
        return sessionStatus === SESSION_STATUSES.WORKING || sessionStatus === SESSION_STATUSES.BLOCKED;
      });

      // Agents that end a turn with idle rather than done (OpenCode) have finished when they go from working back to idle.
      const getAlertedStatus = Effect.fn("getAlertedStatus")(function* (
        heldStatus: AgentStatusValueObject,
        previousHeldStatus: AgentStatusValueObject | undefined
      ) {
        if (heldStatus === AGENT_STATUSES.IDLE && previousHeldStatus === AGENT_STATUSES.WORKING)
          return AGENT_STATUSES.DONE;

        return heldStatus;
      });

      const isSessionWaitingOnUser = Effect.fn("isSessionWaitingOnUser")(function* (
        sessionStatus: SessionStatusValueObject
      ) {
        return (
          sessionStatus === SESSION_STATUSES.BLOCKED ||
          sessionStatus === SESSION_STATUSES.ERROR ||
          sessionStatus === SESSION_STATUSES.DONE
        );
      });

      return {
        getAgentConversationId,
        getAlertedStatus,
        getDefaultSessionName,
        getSessionStatus,
        getSessionTasks,
        getSessionTitle,
        getSessionTitleToSave,
        isSessionTurnRunning,
        isSessionWaitingOnUser,
        prepareLaunchPlan
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionDomainService", this.make()));
}
