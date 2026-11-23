import {NodeServices} from "@effect/platform-node";
import {Context, Effect, Layer} from "effect";
import {Path} from "effect/Path";

import {AggregorFolderUtils} from "@/infraUtils/aggregorFolder.utils.ts";
import {AGGREGOR_WORKSPACE} from "@pkg/constants/src/workspace.constant.ts";

export class AnchorFolderUtils extends Context.Service<AnchorFolderUtils>()(
  "aggregor-app/infrastructure/utils/anchorFolder.utils/AnchorFolderUtils",
  {
    make: Effect.fn("AnchorFolderUtils.make")(function* () {
      const path = yield* Path;
      const aggregorFolderUtils = yield* AggregorFolderUtils;

      // Projects swap at folder 1 behind this hidden, empty folder 0, since changing folder 0 restarts every extension.
      const getAnchorFolderPath = Effect.fn("AnchorFolderUtils.getAnchorFolderPath")(function* () {
        const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;

        return path.join(aggregorFolderPath, AGGREGOR_WORKSPACE.FOLDER_NAME, AGGREGOR_WORKSPACE.ANCHOR_FOLDER_NAME);
      });

      return {getAnchorFolderPath: getAnchorFolderPath()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([AggregorFolderUtils.layer, NodeServices.layer])
  );
}
