import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect} from "effect";
import {Path} from "effect/Path";

// Once the window shows a project, its folder 0 is the anchor folder: empty and hidden. Projects then swap at folder 1,
// since changing folder 0 restarts every extension.
const ANCHOR_DIRECTORY = "anchor";

// VS Code names the folder after it in folder pickers, and Save Workspace As suggests it as the workspace's name.
const ANCHOR_FOLDER_NAME = "Aggregor";

export const getAnchorFolderPath = Effect.fn("getAnchorFolderPath")(function* () {
  const {globalStorageUri} = yield* VsCodeApi;
  const path = yield* Path;

  return path.join(globalStorageUri.fsPath, ANCHOR_DIRECTORY, ANCHOR_FOLDER_NAME);
});
