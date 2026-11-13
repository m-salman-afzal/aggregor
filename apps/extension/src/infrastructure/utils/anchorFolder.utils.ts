import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {AGGREGOR_WORKSPACE} from "@pkg/constants/src/workspace.constant.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

// Projects swap at folder 1 behind this hidden, empty folder 0, since changing folder 0 restarts every extension.
export const getAnchorFolderPath = Effect.fn("getAnchorFolderPath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return path.join(aggregorFolderPath, AGGREGOR_WORKSPACE.FOLDER_NAME, AGGREGOR_WORKSPACE.ANCHOR_FOLDER_NAME);
});
