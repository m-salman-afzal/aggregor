import {SESSION_LABELS, SESSION_NOTICES} from "@pkg/constants/src/session.constant.ts";
import {Effect} from "effect";

export const makeStopAgentsQuestion = Effect.fn("makeStopAgentsQuestion")(function* (
  runningAgentNames: readonly [string, ...string[]],
  turnRunningCount: number
) {
  const [firstRunningAgentName] = runningAgentNames;
  if (runningAgentNames.length === 1)
    return {
      answers: [
        {
          consequence: SESSION_NOTICES.STOP_AGENT_MID_TURN_CONSEQUENCE,
          isDestructive: true,
          label: SESSION_LABELS.STOP_AGENT
        }
      ],
      question: SESSION_NOTICES.CONFIRM_STOP_AGENT(firstRunningAgentName)
    };

  return {
    answers: [
      {
        consequence: SESSION_NOTICES.STOP_AGENTS_MID_TURN_CONSEQUENCE(turnRunningCount),
        isDestructive: true,
        label: SESSION_LABELS.STOP_AGENTS
      }
    ],
    question: SESSION_NOTICES.CONFIRM_STOP_AGENTS(runningAgentNames.length)
  };
});
