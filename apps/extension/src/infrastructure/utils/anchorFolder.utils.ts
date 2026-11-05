import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Hash} from "effect";
import {Path} from "effect/Path";

// Once a window shows a project, its folder 0 is an anchor folder: empty, hidden, and named after the window's key.
// Projects then swap at folder 1, since changing folder 0 restarts every extension.
const ANCHORS_DIRECTORY = "anchors";

// Names the window: the anchor folder's name when folder 0 is one, else folder 0's name and a hash of its path (of ""
// without one), which is also the name its anchor folder gets. So the key stays the same when the anchor folder takes
// folder 0.
export const findWindowKey = Effect.fn("findWindowKey")(function* () {
  const {globalStorageUri, workspace} = yield* VsCodeApi;
  const path = yield* Path;
  const anchorsDirectoryPath = path.join(globalStorageUri.fsPath, ANCHORS_DIRECTORY);
  const [firstWorkspaceFolder] = workspace.workspaceFolders === undefined ? [] : workspace.workspaceFolders;
  const firstFolderPath = firstWorkspaceFolder === undefined ? "" : firstWorkspaceFolder.uri.fsPath;
  if (path.dirname(firstFolderPath) === anchorsDirectoryPath) return path.basename(firstFolderPath);

  return `${path.basename(firstFolderPath)}-${Math.abs(Hash.string(firstFolderPath)).toString(36)}`;
});

export const getAnchorFolderPath = Effect.fn("getAnchorFolderPath")(function* (windowKey: string) {
  const {globalStorageUri} = yield* VsCodeApi;
  const path = yield* Path;

  return path.join(globalStorageUri.fsPath, ANCHORS_DIRECTORY, windowKey);
});
