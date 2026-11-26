import {NodeServices} from "@effect/platform-node";
import {Context, Effect, Layer} from "effect";
import {Path} from "effect/Path";

import {AggregorFolderUtils} from "@/infraUtils/aggregorFolder.utils.ts";
import {AGENT_API} from "@pkg/constants/src/agentApi.constant.ts";

export class AgentApiSocketUtils extends Context.Service<AgentApiSocketUtils>()(
  "aggregor-app/infrastructure/utils/agentApiSocket.utils/AgentApiSocketUtils",
  {
    make: Effect.fn("AgentApiSocketUtils.make")(function* () {
      const path = yield* Path;
      const aggregorFolderUtils = yield* AggregorFolderUtils;

      const getAgentApiSocketPath = Effect.fn("AgentApiSocketUtils.getAgentApiSocketPath")(function* () {
        const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;

        return path.join(aggregorFolderPath, AGENT_API.SOCKET_FILE_NAME);
      });

      return {getAgentApiSocketPath: getAgentApiSocketPath()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([AggregorFolderUtils.layer, NodeServices.layer])
  );
}
