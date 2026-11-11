import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {AGGREGOR_WORKSPACE} from "@pkg/constants/src/workspace.constant.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

// Once the window shows a project, its folder 0 is the anchor folder: empty and hidden. Projects then swap at folder 1,
// since changing folder 0 restarts every extension.
export const getAnchorFolderPath = Effect.fn("getAnchorFolderPath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return path.join(aggregorFolderPath, AGGREGOR_WORKSPACE.FOLDER_NAME, AGGREGOR_WORKSPACE.ANCHOR_FOLDER_NAME);
});
