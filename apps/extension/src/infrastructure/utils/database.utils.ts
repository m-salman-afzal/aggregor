import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

const DATA_FOLDER_NAME = "data";

const DATABASE_FILE_NAME = "aggregor.db";

// The window opens it, and each session's aggregor-pty writes its agent's status to it and its errors beside it.
export const getDatabaseFilePath = Effect.fn("getDatabaseFilePath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return path.join(aggregorFolderPath, DATA_FOLDER_NAME, DATABASE_FILE_NAME);
});
