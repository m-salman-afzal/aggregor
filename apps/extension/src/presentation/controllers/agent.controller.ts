import {SetDefaultAgentRequestDtoSchema} from "@dtos/agent.dto.ts";
import {AppErrorMessage} from "@errorMessages/app.errorMessage.ts";
import {RegisterCommandMiddleware} from "@middlewares/registerCommand.middleware.ts";
import {AGENT_COMMANDS} from "@pkg/constants/src/agent.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {AgentService} from "@services/agent.service.ts";
import {Context, Effect, Layer} from "effect";

export class AgentController extends Context.Service<AgentController>()(
  "aggregor-app/presentation/controllers/agent.controller/AgentController",
  {
    make: Effect.fn("AgentController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const agentService = yield* AgentService;
      const appErrorMessage = yield* AppErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const setChosenAgentAsDefault = Effect.fn("AgentController.setChosenAgentAsDefault")(function* (
        chosenAgent: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(SetDefaultAgentRequestDtoSchema, chosenAgent);
        yield* agentService.setDefaultAgent(request);
      });

      const listAgentsForSessionsView = Effect.fn("AgentController.listAgentsForSessionsView")(function* () {
        return yield* agentService.listAgents;
      });

      yield* registerCommandMiddleware.registerCommand(
        AGENT_COMMANDS.SET_DEFAULT,
        setChosenAgentAsDefault,
        appErrorMessage.getAppCommandErrorMessage
      );

      return {listAgentsForSessionsView: listAgentsForSessionsView(), setChosenAgentAsDefault};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([AppErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
