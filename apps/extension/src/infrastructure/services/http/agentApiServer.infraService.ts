// @effect-diagnostics-next-line nodeBuiltinImport:off -- NodeHttpServer serves on a server node:http creates
import {createServer} from "node:http";
import {connect} from "node:net";

import {NodeHttpServer, NodeServices} from "@effect/platform-node";
import {Context, Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {HttpServer} from "effect/http";
import {NetAddress} from "effect/net";
import {Path} from "effect/Path";

import {AgentApiSocketUtils} from "@/infraUtils/agentApiSocket.utils.ts";
import {AGENT_API} from "@pkg/constants/src/agentApi.constant.ts";
import {AGGREGOR_FOLDER} from "@pkg/constants/src/app.constant.ts";

export class AgentApiServerInfraService extends Context.Service<AgentApiServerInfraService>()(
  "aggregor-app/infrastructure/services/http/agentApiServer.infraService/AgentApiServerInfraService",
  {
    make: Effect.fn("AgentApiServerInfraService.make")(function* () {
      const agentApiSocketUtils = yield* AgentApiSocketUtils;
      const fileSystem = yield* FileSystem;
      const path = yield* Path;

      const isSocketAnswering = Effect.fn("AgentApiServerInfraService.isSocketAnswering")(function* (
        socketPath: string
      ) {
        return yield* Effect.callback<boolean>((resume) => {
          const probeSocket = connect(socketPath);
          probeSocket.once("connect", () => {
            probeSocket.destroy();
            resume(Effect.succeed(true));
          });
          probeSocket.once("error", () => {
            resume(Effect.succeed(false));
          });
        });
      });

      // Serves nothing: another window answers on the socket, or this one could not listen on it.
      const makeServerServingNothing = Effect.fn("AgentApiServerInfraService.makeServerServingNothing")(function* (
        socketPath: string
      ) {
        return HttpServer.make({address: NetAddress.unixPathAddress(socketPath), serve: () => Effect.void});
      });

      // Node unlinks the socket when the server closes; a crash leaves it behind, refused, for the next window to remove.
      const listenOnSocket = Effect.fn("AgentApiServerInfraService.listenOnSocket")(function* (socketPath: string) {
        yield* fileSystem.makeDirectory(path.dirname(socketPath), {mode: AGGREGOR_FOLDER.MODE, recursive: true});
        yield* fileSystem.remove(socketPath, {force: true});
        const httpServer = yield* NodeHttpServer.make(() => createServer(), {path: socketPath});
        yield* fileSystem.chmod(socketPath, AGENT_API.SOCKET_FILE_MODE);

        return httpServer;
      });

      const takeAgentApiSocket = Effect.fn("AgentApiServerInfraService.takeAgentApiSocket")(
        function* (socketPath: string) {
          const isServedElsewhere = yield* isSocketAnswering(socketPath);
          if (!isServedElsewhere) return yield* listenOnSocket(socketPath);
          yield* Effect.logInfo("Another window serves the agent API");

          return yield* makeServerServingNothing(socketPath);
        },
        (agentApiServer, socketPath) =>
          Effect.catch(agentApiServer, (serveError) =>
            Effect.andThen(
              Effect.logWarning("Could not serve the agent API", serveError),
              makeServerServingNothing(socketPath)
            )
          )
      );

      const socketPath = yield* agentApiSocketUtils.getAgentApiSocketPath;

      return yield* takeAgentApiSocket(socketPath);
    })
  }
) {
  public static readonly layer = Layer.effect(HttpServer.HttpServer, this.make()).pipe(
    Layer.provide([AgentApiSocketUtils.layer, NodeServices.layer])
  );
}
