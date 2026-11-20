import {NodeServices} from "@effect/platform-node";
import {AggregorFolderUtils} from "@infraUtils/aggregorFolder.utils.ts";
import {TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {Context, Effect, Layer} from "effect";
import {Path} from "effect/Path";

export class TmuxSocketUtils extends Context.Service<TmuxSocketUtils>()(
  "aggregor-app/infrastructure/utils/tmuxSocket.utils/TmuxSocketUtils",
  {
    make: Effect.fn("TmuxSocketUtils.make")(function* () {
      const path = yield* Path;
      const aggregorFolderUtils = yield* AggregorFolderUtils;

      const getTmuxSocketPath = Effect.fn("TmuxSocketUtils.getTmuxSocketPath")(function* () {
        const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;

        return path.join(aggregorFolderPath, TMUX.SOCKET_FILE_NAME);
      });

      return {getTmuxSocketPath: getTmuxSocketPath()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([AggregorFolderUtils.layer, NodeServices.layer])
  );
}
