import {DATA_DIRECTORY_ENV} from "@pkg/constants/src/extension.constant.ts";
import {Config, Effect} from "effect";
import {Path} from "effect/Path";
import {homedir} from "node:os";

const DATABASE_FILE_NAME = "aggregor.db";

// The window opens it, and each session's aggregor-pty writes its agent's status to it.
export const getDatabaseFilePath = Effect.fn("getDatabaseFilePath")(function* () {
  const path = yield* Path;
  const dataDirectoryPath = yield* Config.withDefault(
    Config.String(DATA_DIRECTORY_ENV),
    path.join(homedir(), ".aggregor")
  );

  return path.join(dataDirectoryPath, DATABASE_FILE_NAME);
});
