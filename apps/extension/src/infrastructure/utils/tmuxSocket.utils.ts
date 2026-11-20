import {NodeServices} from "@effect/platform-node";
import {AggregorFolderUtils} from "@infraUtils/aggregorFolder.utils.ts";
import {TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer} from "effect";
import {Path} from "effect/Path";

export class TmuxSocketUtils extends Context.Service<TmuxSocketUtils>()(
  "aggregor-app/infrastructure/utils/tmuxSocket.utils/TmuxSocketUtils",
  {
    make: Effect.fn("make")(function* () {
      const path = yield* Path;
      const aggregorFolderUtils = yield* AggregorFolderUtils;

      const getTmuxSocketPath = Effect.fn("getTmuxSocketPath")(function* () {
        const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;

        return path.join(aggregorFolderPath, TMUX.SOCKET_FILE_NAME);
      });

      return {getTmuxSocketPath: getTmuxSocketPath()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("TmuxSocketUtils", this.make())).pipe(
    Layer.provide([AggregorFolderUtils.layer, NodeServices.layer])
  );
}
