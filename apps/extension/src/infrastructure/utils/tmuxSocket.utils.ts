import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

// Where Aggregor's own tmux server listens.
export const getTmuxSocketPath = Effect.fn("getTmuxSocketPath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return path.join(aggregorFolderPath, TMUX.SOCKET_FILE_NAME);
});
