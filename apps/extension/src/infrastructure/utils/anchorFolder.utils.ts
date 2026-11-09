import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

// Once the window shows a project, its folder 0 is the anchor folder: empty and hidden. Projects then swap at folder 1,
// since changing folder 0 restarts every extension. It sits a level down, so the window never watches the database.
const ANCHOR_DIRECTORY = "anchor";

// VS Code names the folder after it in folder pickers.
const ANCHOR_FOLDER_NAME = "Aggregor";

export const getAnchorFolderPath = Effect.fn("getAnchorFolderPath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return path.join(aggregorFolderPath, ANCHOR_DIRECTORY, ANCHOR_FOLDER_NAME);
});
