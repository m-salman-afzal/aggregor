import {SetDefaultAgentRequestDtoSchema} from "@dtos/agent.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {listAgents, setDefaultAgent} from "@services/agent.service.ts";
import {Effect} from "effect";

export const setChosenAgentAsDefault = Effect.fn("AgentController.setChosenAgentAsDefault")(function* (
  chosenAgent: unknown
) {
  const request = yield* decodeVsCodeArgument(SetDefaultAgentRequestDtoSchema, chosenAgent);
  yield* setDefaultAgent(request);
});

export const listAgentsForSessionsView = Effect.fn("AgentController.listAgentsForSessionsView")(function* () {
  return yield* listAgents();
});
