import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {AGENT_TASK_KINDS} from "@valueObjects/agentTaskKind.valueObject.ts";
import {Context, Effect, Layer, Record, Result, String} from "effect";

import type {AgentTaskKindValueObject} from "@valueObjects/agentTaskKind.valueObject.ts";

// Claude Code's own table (2.1.328), not part of OSC 7501: an id it doesn't list, or another agent's, is other.
const AGENT_TASK_KINDS_BY_ID_PREFIX: Record.ReadonlyRecord<string, AgentTaskKindValueObject> = {
  a: AGENT_TASK_KINDS.SUB_AGENT,
  b: AGENT_TASK_KINDS.SHELL,
  k: AGENT_TASK_KINDS.MCP_TASK,
  m: AGENT_TASK_KINDS.MONITOR,
  r: AGENT_TASK_KINDS.REMOTE_AGENT,
  s: AGENT_TASK_KINDS.MONITOR,
  t: AGENT_TASK_KINDS.TEAMMATE,
  w: AGENT_TASK_KINDS.WORKFLOW
};

export class AgentTaskDomainService extends Context.Service<AgentTaskDomainService>()(
  "aggregor-app/domain/services/agentTask.domainService/AgentTaskDomainService",
  {
    make: Effect.fn("make")(function* () {
      const getAgentTaskKind = Effect.fn("getAgentTaskKind")(function* (taskId: string) {
        const taskIdPrefix = String.slice(0, 1)(taskId);

        return Result.merge(
          Result.fromOption(Record.get(AGENT_TASK_KINDS_BY_ID_PREFIX, taskIdPrefix), () => AGENT_TASK_KINDS.OTHER)
        );
      });

      return {getAgentTaskKind};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("AgentTaskDomainService", this.make()));
}
