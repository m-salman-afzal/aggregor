import {getAggregorFolderPath, readAbsolutePathVariable} from "@infraUtils/aggregorFolder.utils.ts";
import {DATABASE_FILE} from "@pkg/constants/src/database.constant.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

// The window opens it, and each session's aggregor-pty writes its agent's status to it and its errors beside it.
export const getDatabaseFilePath = Effect.fn("getDatabaseFilePath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return yield* readAbsolutePathVariable(
    DATABASE_FILE.ENVIRONMENT_VARIABLE,
    path.join(aggregorFolderPath, DATABASE_FILE.FOLDER_NAME, DATABASE_FILE.FILE_NAME)
  );
});
