import {AGGREGOR_FOLDER_ENV} from "@pkg/constants/src/app.constant.ts";
import {Config, Effect} from "effect";
import {Path} from "effect/Path";
import {homedir} from "node:os";

// Where Aggregor keeps its files: data/ holds the database and aggregor-pty's log, anchor/ the window's anchor folder.
export const getAggregorFolderPath = Effect.fn("getAggregorFolderPath")(function* () {
  const path = yield* Path;

  return yield* Config.withDefault(Config.String(AGGREGOR_FOLDER_ENV), path.join(homedir(), ".aggregor"));
});
