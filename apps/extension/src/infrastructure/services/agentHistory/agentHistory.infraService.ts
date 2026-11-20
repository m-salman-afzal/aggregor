import {NodeServices} from "@effect/platform-node";
import {ClaudeHistoryUtils} from "@infraServices/agentHistory/claudeHistory.utils.ts";
import {CodexHistoryUtils} from "@infraServices/agentHistory/codexHistory.utils.ts";
import {CopilotHistoryUtils} from "@infraServices/agentHistory/copilotHistory.utils.ts";
import {OpenCodeHistoryUtils} from "@infraServices/agentHistory/openCodeHistory.utils.ts";
import {
  IAgentHistoryInfraService,
  IAgentHistoryInfraServiceErrors
} from "@interfaces/agentHistory.infraService.interface.ts";
import {AGENT_HISTORY_AGENT_IDS} from "@pkg/constants/src/agentHistory.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer} from "effect";

import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

type ConversationReader =
  | ClaudeHistoryUtils["Service"]["listClaudeConversations"]
  | CodexHistoryUtils["Service"]["listCodexConversations"]
  | CopilotHistoryUtils["Service"]["listCopilotConversations"]
  | OpenCodeHistoryUtils["Service"]["listOpenCodeConversations"];

export class AgentHistoryInfraService extends Context.Service<AgentHistoryInfraService>()(
  "aggregor-app/infrastructure/services/agentHistory/agentHistory.infraService/AgentHistoryInfraService",
  {
    make: Effect.fn("make")(function* () {
      const claudeHistoryUtils = yield* ClaudeHistoryUtils;
      const codexHistoryUtils = yield* CodexHistoryUtils;
      const copilotHistoryUtils = yield* CopilotHistoryUtils;
      const openCodeHistoryUtils = yield* OpenCodeHistoryUtils;
      const conversationReaders: Readonly<Record<string, ConversationReader>> = {
        [AGENT_HISTORY_AGENT_IDS.CLAUDE]: claudeHistoryUtils.listClaudeConversations,
        [AGENT_HISTORY_AGENT_IDS.CODEX]: codexHistoryUtils.listCodexConversations,
        [AGENT_HISTORY_AGENT_IDS.COPILOT]: copilotHistoryUtils.listCopilotConversations,
        [AGENT_HISTORY_AGENT_IDS.OPENCODE]: openCodeHistoryUtils.listOpenCodeConversations
      };

      const listAgentConversations = Effect.fn("listAgentConversations")(function* (
        agentId: AgentIdValueObject,
        folderPath: ProjectPathValueObject
      ) {
        yield* Effect.annotateCurrentSpan({agentId, folderPath});
        const conversationReader = conversationReaders[agentId];
        if (conversationReader === undefined)
          return yield* IAgentHistoryInfraServiceErrors.AgentHistoryNotReadError.make({agentId});
        const agentConversations = yield* Effect.mapError(conversationReader(folderPath), (cause) =>
          IAgentHistoryInfraServiceErrors.AgentHistoryReadFailedError.make({agentId, cause})
        );
        yield* Effect.annotateCurrentSpan({conversationCount: agentConversations.length});

        return agentConversations;
      });

      return {listAgentConversations};
    })
  }
) {
  public static readonly layer = Layer.effect(
    IAgentHistoryInfraService,
    ownSpans("AgentHistoryInfraService", this.make())
  ).pipe(
    Layer.provide([
      ClaudeHistoryUtils.layer,
      CodexHistoryUtils.layer,
      CopilotHistoryUtils.layer,
      OpenCodeHistoryUtils.layer,
      NodeServices.layer
    ])
  );
}
