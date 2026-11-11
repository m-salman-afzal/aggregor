import {SESSION_LABELS, SESSION_NOTICES} from "@pkg/constants/src/session.constant.ts";
import {Effect, Match} from "effect";

// The questions that stopping or archiving a session's agent asks, worded for one agent or several, and for agents cut
// short in the middle of a turn.

const getStopAgentsConsequence = Effect.fn("getStopAgentsConsequence")(function* (
  runningAgentCount: number,
  turnRunningCount: number
) {
  return Match.value({isAnyTurnRunning: turnRunningCount > 0, isOneAgent: runningAgentCount === 1}).pipe(
    Match.when({isAnyTurnRunning: false, isOneAgent: true}, () => SESSION_NOTICES.STOP_AGENT_CONSEQUENCE),
    Match.when({isAnyTurnRunning: true, isOneAgent: true}, () => SESSION_NOTICES.STOP_AGENT_MID_TURN_CONSEQUENCE),
    Match.when({isAnyTurnRunning: false, isOneAgent: false}, () => SESSION_NOTICES.STOP_AGENTS_CONSEQUENCE),
    Match.when({isAnyTurnRunning: true, isOneAgent: false}, () =>
      SESSION_NOTICES.STOP_AGENTS_MID_TURN_CONSEQUENCE(turnRunningCount)
    ),
    Match.exhaustive
  );
});

export const makeStopAgentsQuestion = Effect.fn("makeStopAgentsQuestion")(function* (
  runningAgentNames: readonly [string, ...string[]],
  turnRunningCount: number
) {
  const [firstRunningAgentName] = runningAgentNames;
  const consequence = yield* getStopAgentsConsequence(runningAgentNames.length, turnRunningCount);
  if (runningAgentNames.length === 1)
    return {
      answers: [{consequence, label: SESSION_LABELS.STOP_AGENT}],
      question: SESSION_NOTICES.CONFIRM_STOP_AGENT(firstRunningAgentName)
    };

  return {
    answers: [{consequence, label: SESSION_LABELS.STOP_AGENTS}],
    question: SESSION_NOTICES.CONFIRM_STOP_AGENTS(runningAgentNames.length)
  };
});

const getKeepAgentsConsequence = Effect.fn("getKeepAgentsConsequence")(function* (
  runningAgentCount: number,
  turnRunningCount: number
) {
  return Match.value({isAnyTurnRunning: turnRunningCount > 0, isOneAgent: runningAgentCount === 1}).pipe(
    Match.when({isAnyTurnRunning: false, isOneAgent: true}, () => SESSION_NOTICES.ARCHIVE_KEEPING_AGENT),
    Match.when({isAnyTurnRunning: true, isOneAgent: true}, () => SESSION_NOTICES.ARCHIVE_KEEPING_AGENT_MID_TURN),
    Match.when({isAnyTurnRunning: false, isOneAgent: false}, () => SESSION_NOTICES.ARCHIVE_KEEPING_AGENTS),
    Match.when({isAnyTurnRunning: true, isOneAgent: false}, () =>
      SESSION_NOTICES.ARCHIVE_KEEPING_AGENTS_MID_TURN(turnRunningCount)
    ),
    Match.exhaustive
  );
});

// Keep Agent Running comes first, so Enter keeps the agents.
const makeKeepOrStopAgentsAnswers = Effect.fn("makeKeepOrStopAgentsAnswers")(function* (
  runningAgentCount: number,
  turnRunningCount: number
) {
  const isOneAgent = runningAgentCount === 1;

  return [
    {
      consequence: yield* getKeepAgentsConsequence(runningAgentCount, turnRunningCount),
      label: isOneAgent ? SESSION_LABELS.KEEP_AGENT_RUNNING : SESSION_LABELS.KEEP_AGENTS_RUNNING
    },
    {
      consequence: yield* getStopAgentsConsequence(runningAgentCount, turnRunningCount),
      label: isOneAgent ? SESSION_LABELS.STOP_AGENT : SESSION_LABELS.STOP_AGENTS
    }
  ];
});

export const makeArchiveQuestion = Effect.fn("makeArchiveQuestion")(function* (
  sessionName: string,
  turnRunningCount: number
) {
  return {
    answers: yield* makeKeepOrStopAgentsAnswers(1, turnRunningCount),
    question: SESSION_NOTICES.ASK_ARCHIVE_WITH_AGENT_RUNNING(sessionName)
  };
});

// With no agent running, it only confirms, since one click moves every session.
export const makeArchiveSessionsQuestion = Effect.fn("makeArchiveSessionsQuestion")(function* (
  sessionCount: number,
  runningAgentCount: number,
  turnRunningCount: number
) {
  if (runningAgentCount === 0)
    return {
      answers: [{consequence: SESSION_NOTICES.ARCHIVE_SESSIONS_CONSEQUENCE, label: SESSION_LABELS.ARCHIVE_SESSIONS}],
      question: SESSION_NOTICES.ASK_ARCHIVE_SESSIONS(sessionCount)
    };

  return {
    answers: yield* makeKeepOrStopAgentsAnswers(runningAgentCount, turnRunningCount),
    question:
      runningAgentCount === 1
        ? SESSION_NOTICES.ASK_ARCHIVE_SESSIONS_WITH_AGENT_RUNNING(sessionCount)
        : SESSION_NOTICES.ASK_ARCHIVE_SESSIONS_WITH_AGENTS_RUNNING(sessionCount, runningAgentCount)
  };
});
