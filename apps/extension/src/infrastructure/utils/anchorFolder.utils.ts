import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Hash} from "effect";
import {Path} from "effect/Path";

// Once a window shows a project, its folder 0 is an anchor folder: empty, hidden, and in a directory named after the
// window's key. Projects then swap at folder 1, since changing folder 0 restarts every extension.
const ANCHORS_DIRECTORY = "anchors";

// VS Code names the folder after it in folder pickers, and Save Workspace As suggests it as the workspace's name.
const ANCHOR_FOLDER_NAME = "Aggregor";

// Names the window: the anchor folder's directory name when folder 0 is one, else folder 0's name and a hash of its path,
// which is also the name its anchor folder's directory gets, so the key stays the same when the anchor folder takes
// folder 0. A window without folders is named after its session, so empty windows never share a key; adding a project
// anchors one at once, which keeps that key.
export const findWindowKey = Effect.fn("findWindowKey")(function* () {
  const {env, globalStorageUri, workspace} = yield* VsCodeApi;
  const path = yield* Path;
  const anchorsDirectoryPath = path.join(globalStorageUri.fsPath, ANCHORS_DIRECTORY);
  const [firstWorkspaceFolder] = workspace.workspaceFolders === undefined ? [] : workspace.workspaceFolders;
  if (firstWorkspaceFolder === undefined) return `window-${Math.abs(Hash.string(env.sessionId)).toString(36)}`;
  const firstFolderPath = firstWorkspaceFolder.uri.fsPath;
  const firstFolderDirectoryPath = path.dirname(firstFolderPath);
  if (path.dirname(firstFolderDirectoryPath) === anchorsDirectoryPath) return path.basename(firstFolderDirectoryPath);

  return `${path.basename(firstFolderPath)}-${Math.abs(Hash.string(firstFolderPath)).toString(36)}`;
});

export const getAnchorFolderPath = Effect.fn("getAnchorFolderPath")(function* (windowKey: string) {
  const {globalStorageUri} = yield* VsCodeApi;
  const path = yield* Path;

  return path.join(globalStorageUri.fsPath, ANCHORS_DIRECTORY, windowKey, ANCHOR_FOLDER_NAME);
});
