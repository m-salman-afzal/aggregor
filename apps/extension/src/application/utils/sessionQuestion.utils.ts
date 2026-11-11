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

// Keep Agent Running comes first, so Enter keeps it.
export const makeArchiveQuestion = Effect.fn("makeArchiveQuestion")(function* (
  sessionName: string,
  turnRunningCount: number
) {
  return {
    answers: [
      {
        consequence:
          turnRunningCount === 0
            ? SESSION_NOTICES.ARCHIVE_KEEPING_AGENT
            : SESSION_NOTICES.ARCHIVE_KEEPING_AGENT_MID_TURN,
        label: SESSION_LABELS.KEEP_AGENT_RUNNING
      },
      {consequence: yield* getStopAgentsConsequence(1, turnRunningCount), label: SESSION_LABELS.STOP_AGENT}
    ],
    question: SESSION_NOTICES.ASK_ARCHIVE_WITH_AGENT_RUNNING(sessionName)
  };
});
