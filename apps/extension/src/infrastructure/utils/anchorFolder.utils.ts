import {NodeServices} from "@effect/platform-node";
import {AggregorFolderUtils} from "@infraUtils/aggregorFolder.utils.ts";
import {AGGREGOR_WORKSPACE} from "@pkg/constants/src/workspace.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer} from "effect";
import {Path} from "effect/Path";

export class AnchorFolderUtils extends Context.Service<AnchorFolderUtils>()(
  "aggregor-app/infrastructure/utils/anchorFolder.utils/AnchorFolderUtils",
  {
    make: Effect.fn("make")(function* () {
      const path = yield* Path;
      const aggregorFolderUtils = yield* AggregorFolderUtils;

      // Projects swap at folder 1 behind this hidden, empty folder 0, since changing folder 0 restarts every extension.
      const getAnchorFolderPath = Effect.fn("getAnchorFolderPath")(function* () {
        const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;

        return path.join(aggregorFolderPath, AGGREGOR_WORKSPACE.FOLDER_NAME, AGGREGOR_WORKSPACE.ANCHOR_FOLDER_NAME);
      });

      return {getAnchorFolderPath: getAnchorFolderPath()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("AnchorFolderUtils", this.make())).pipe(
    Layer.provide([AggregorFolderUtils.layer, NodeServices.layer])
  );
}
