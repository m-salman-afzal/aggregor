import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

const TMUX_SOCKET_FILE_NAME = "tmux.sock";

// Aggregor's own tmux server listens here (tmux -S), apart from the user's tmux, and a test's Aggregor folder gets a
// server of its own.
export const getTmuxSocketPath = Effect.fn("getTmuxSocketPath")(function* () {
  const path = yield* Path;
  const aggregorFolderPath = yield* getAggregorFolderPath();

  return path.join(aggregorFolderPath, TMUX_SOCKET_FILE_NAME);
});
