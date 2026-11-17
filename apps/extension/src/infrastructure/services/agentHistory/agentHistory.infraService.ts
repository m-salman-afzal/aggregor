import {listClaudeConversations} from "@infraServices/agentHistory/claudeHistory.utils.ts";
import {listCodexConversations} from "@infraServices/agentHistory/codexHistory.utils.ts";
import {listCopilotConversations} from "@infraServices/agentHistory/copilotHistory.utils.ts";
import {listOpenCodeConversations} from "@infraServices/agentHistory/openCodeHistory.utils.ts";
import {
  AgentHistoryNotReadError,
  AgentHistoryReadFailedError,
  IAgentHistoryInfraService
} from "@interfaces/agentHistory.infraService.interface.ts";
import {AGENT_HISTORY_AGENT_IDS} from "@pkg/constants/src/agentHistory.constant.ts";
import {Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {homedir} from "node:os";

import type {AgentHistoryDependencies} from "@infraServices/agentHistory/agentHistory.infraService.type.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

type ConversationReader =
  | typeof listClaudeConversations
  | typeof listCodexConversations
  | typeof listCopilotConversations
  | typeof listOpenCodeConversations;

const conversationReaders: Readonly<Record<string, ConversationReader>> = {
  [AGENT_HISTORY_AGENT_IDS.CLAUDE]: listClaudeConversations,
  [AGENT_HISTORY_AGENT_IDS.CODEX]: listCodexConversations,
  [AGENT_HISTORY_AGENT_IDS.COPILOT]: listCopilotConversations,
  [AGENT_HISTORY_AGENT_IDS.OPENCODE]: listOpenCodeConversations
};

const listAgentConversations = Effect.fn("AgentHistoryInfraService.listAgentConversations")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  agentId: AgentIdValueObject,
  folderPath: ProjectPathValueObject
) {
  yield* Effect.annotateCurrentSpan({agentId, folderPath});
  const conversationReader = conversationReaders[agentId];
  if (conversationReader === undefined) return yield* AgentHistoryNotReadError.make({agentId});
  const agentConversations = yield* Effect.mapError(conversationReader(agentHistoryDependencies, folderPath), (cause) =>
    AgentHistoryReadFailedError.make({agentId, cause})
  );
  yield* Effect.annotateCurrentSpan({conversationCount: agentConversations.length});

  return agentConversations;
});

const makeAgentHistoryInfraService = Effect.fn("AgentHistoryInfraService.make")(function* () {
  const agentHistoryDependencies: AgentHistoryDependencies = {
    fileSystem: yield* FileSystem,
    homeFolderPath: homedir(),
    path: yield* Path
  };

  return {
    listAgentConversations: (agentId: AgentIdValueObject, folderPath: ProjectPathValueObject) =>
      listAgentConversations(agentHistoryDependencies, agentId, folderPath)
  };
});

export const AgentHistoryInfraService = Layer.effect(IAgentHistoryInfraService, makeAgentHistoryInfraService());
