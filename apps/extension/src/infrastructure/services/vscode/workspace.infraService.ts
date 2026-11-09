import {getAnchorFolderPath} from "@infraUtils/anchorFolder.utils.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {fromEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Layer, Ref, Schema, Stream} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {WorkspaceFolderProject} from "@interfaces/workspace.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Uri} from "vscode";

// What the workspace functions share: VS Code's workspace and Uri, the file system, and the anchor folder.
type WorkspaceDependencies = {
  readonly anchorFolderPath: string;
  readonly fileSystem: FileSystem;
  readonly path: Path;
  // The project the extensions in FOLDER_SELECT_COMMANDS were last told about.
  readonly selectedProjectPath: Ref.Ref<ProjectPathValueObject | undefined>;
} & Pick<VsCodeApi["Service"], "commands" | "extensions" | "Uri" | "workspace">;

// One splice of the folder list, as updateWorkspaceFolders takes it.
interface WorkspaceFoldersSplice {
  readonly deleteCount: number;
  readonly foldersToAdd: readonly WorkspaceFolderToAdd[];
  readonly start: number;
}

// A folder as updateWorkspaceFolders adds it.
interface WorkspaceFolderToAdd {
  readonly uri: Uri;
}

class FolderSelectFailedError extends Schema.TaggedError<FolderSelectFailedError, {readonly brand: unique symbol}>()(
  "FolderSelectFailedError",
  {cause: Schema.Unknown}
) {}
class WorkspaceFoldersUpdateRejectedError extends Schema.TaggedError<
  WorkspaceFoldersUpdateRejectedError,
  {readonly brand: unique symbol}
>()("WorkspaceFoldersUpdateRejectedError", {}) {}

// The anchor folder's own settings. Excluding everything hides its row in Explorer and touches no other folder; its
// terminal cwd set to the shown project makes New Terminal count the two folders as one, so it opens there unasked.
const AnchorFolderSettingsJson = Schema.fromJsonString(
  Schema.Struct({
    "files.exclude": Schema.Record(Schema.String, Schema.Boolean),
    "terminal.integrated.cwd": Schema.String
  })
);

// Extensions that work in one workspace folder and take folder 0, the anchor folder, until told otherwise, with the
// command that tells them.
const FOLDER_SELECT_COMMANDS = [{command: "mise.selectWorkspaceFolder", extensionId: "hverlin.mise-vscode"}] as const;

// Beside the anchor folder; once it exists, the window was offered to save its workspace.
const SAVE_OFFERED_MARKER = "saveOffered";

// Every workspace folder's path, the anchor folder's included.
const readWorkspaceFolderPaths = Effect.fn("WorkspaceInfraService.readWorkspaceFolderPaths")(function* ({
  workspace
}: WorkspaceDependencies) {
  return yield* Effect.sync(() =>
    Array.map(workspace.workspaceFolders === undefined ? [] : workspace.workspaceFolders, (workspaceFolder) =>
      ProjectPathValueObjectSchema.make(workspaceFolder.uri.fsPath)
    )
  );
});

const listWorkspaceFolderProjects = Effect.fn("WorkspaceInfraService.listWorkspaceFolderProjects")(function* ({
  anchorFolderPath,
  workspace
}: WorkspaceDependencies) {
  return yield* Effect.sync(() => {
    const workspaceFolders = workspace.workspaceFolders === undefined ? [] : workspace.workspaceFolders;
    const projectFolders = Array.filter(workspaceFolders, (folder) => folder.uri.fsPath !== anchorFolderPath);

    return Array.map(projectFolders, (projectFolder): WorkspaceFolderProject => ({
      name: projectFolder.name,
      path: ProjectPathValueObjectSchema.make(projectFolder.uri.fsPath)
    }));
  });
});

// One change at a time: VS Code rejects a folder update made before the last one fired onDidChangeWorkspaceFolders.
const updateWorkspaceFolders = Effect.fn("WorkspaceInfraService.updateWorkspaceFolders")(
  function* ({workspace}: WorkspaceDependencies, {deleteCount, foldersToAdd, start}: WorkspaceFoldersSplice) {
    yield* Effect.callback<undefined, WorkspaceFoldersUpdateRejectedError>((resume) => {
      const changeListener = workspace.onDidChangeWorkspaceFolders(() => {
        changeListener.dispose();
        resume(Effect.undefined);
      });
      if (!workspace.updateWorkspaceFolders(start, deleteCount, ...foldersToAdd)) {
        changeListener.dispose();
        resume(Effect.fail(WorkspaceFoldersUpdateRejectedError.make()));
      }

      return Effect.sync(() => {
        changeListener.dispose();
      });
    });
  },
  // A change to folder 0 restarts the extension host, and this one never hears back.
  Effect.timeout("5 seconds")
);

// Written before every switch, which also brings back a deleted or edited copy.
const writeAnchorFolderSettings = Effect.fn("WorkspaceInfraService.writeAnchorFolderSettings")(function* (
  {anchorFolderPath, fileSystem, path}: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  const settingsDirectoryPath = path.join(anchorFolderPath, ".vscode");
  const settingsJson = yield* Schema.encodeEffect(AnchorFolderSettingsJson)({
    "files.exclude": {"**": true},
    "terminal.integrated.cwd": projectPath
  });
  yield* fileSystem.makeDirectory(settingsDirectoryPath, {recursive: true});
  yield* fileSystem.writeFileString(path.join(settingsDirectoryPath, "settings.json"), settingsJson);
});

// Replaces every folder with the anchor folder and the project, which restarts every extension.
const anchorWorkspace = Effect.fn("WorkspaceInfraService.anchorWorkspace")(function* (
  workspaceDependencies: WorkspaceDependencies,
  workspaceFolderCount: number,
  projectFolder: WorkspaceFolderToAdd
) {
  const {anchorFolderPath, Uri} = workspaceDependencies;
  const anchorFolder: WorkspaceFolderToAdd = {uri: Uri.file(anchorFolderPath)};

  yield* updateWorkspaceFolders(workspaceDependencies, {
    deleteCount: workspaceFolderCount,
    foldersToAdd: [anchorFolder, projectFolder],
    start: 0
  });
});

// Writes the anchor folder's settings for the project, then swaps it in at folder 1, or anchors the workspace first.
const moveProjectFolderIn = Effect.fn("WorkspaceInfraService.moveProjectFolderIn")(function* (
  workspaceDependencies: WorkspaceDependencies,
  workspaceFolderPaths: readonly ProjectPathValueObject[],
  projectPath: ProjectPathValueObject
) {
  yield* writeAnchorFolderSettings(workspaceDependencies, projectPath);
  const projectFolder: WorkspaceFolderToAdd = {uri: workspaceDependencies.Uri.file(projectPath)};
  if (workspaceFolderPaths[0] === workspaceDependencies.anchorFolderPath)
    yield* updateWorkspaceFolders(workspaceDependencies, {
      deleteCount: workspaceFolderPaths.length - 1,
      foldersToAdd: [projectFolder],
      start: 1
    });
  else yield* anchorWorkspace(workspaceDependencies, workspaceFolderPaths.length, projectFolder);
});

// Once per project and extension host: a restarted host's extensions start from folder 0 again.
const selectProjectFolderInExtensions = Effect.fn("WorkspaceInfraService.selectProjectFolderInExtensions")(function* (
  {commands, extensions, selectedProjectPath, Uri}: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  if ((yield* Ref.getAndSet(selectedProjectPath, projectPath)) === projectPath) return;
  const installedFolderSelectCommands = Array.filter(
    FOLDER_SELECT_COMMANDS,
    ({extensionId}) => extensions.getExtension(extensionId) !== undefined
  );

  yield* Effect.forEach(installedFolderSelectCommands, ({command}) =>
    Effect.tryPromise({
      catch: (cause) => FolderSelectFailedError.make({cause}),
      try: () => commands.executeCommand(command, Uri.file(projectPath))
    })
  );
});

const showOnlyProjectFolder = Effect.fn("WorkspaceInfraService.showOnlyProjectFolder")(
  function* (workspaceDependencies: WorkspaceDependencies, projectPath: ProjectPathValueObject) {
    const workspaceFolderPaths = yield* readWorkspaceFolderPaths(workspaceDependencies);
    const projectFolderPaths = Array.filter(
      workspaceFolderPaths,
      (folderPath) => folderPath !== workspaceDependencies.anchorFolderPath
    );
    const isProjectShownAlone = projectFolderPaths.length === 1 && projectFolderPaths[0] === projectPath;
    if (!isProjectShownAlone) yield* moveProjectFolderIn(workspaceDependencies, workspaceFolderPaths, projectPath);

    yield* selectProjectFolderInExtensions(workspaceDependencies, projectPath);
  },
  Effect.ignore({log: "Warn", message: "Could not show the project in the workspace"})
);

const removeProjectFolder = Effect.fn("WorkspaceInfraService.removeProjectFolder")(
  function* (workspaceDependencies: WorkspaceDependencies, projectPath: ProjectPathValueObject) {
    const workspaceFolderPaths = yield* readWorkspaceFolderPaths(workspaceDependencies);
    const projectFolderIndex = workspaceFolderPaths.indexOf(projectPath);
    // Changing folder 0 would restart every extension, so a project there stays.
    if (projectFolderIndex < 1) return;

    yield* updateWorkspaceFolders(workspaceDependencies, {deleteCount: 1, foldersToAdd: [], start: projectFolderIndex});
  },
  Effect.ignore({log: "Warn", message: "Could not take the project out of the workspace"})
);

// The window's workspace is unsaved, as the first switch leaves it, and its folder 0 is our anchor folder.
const isUnsavedAnchoredWorkspace = Effect.fn("WorkspaceInfraService.isUnsavedAnchoredWorkspace")(function* ({
  anchorFolderPath,
  workspace
}: WorkspaceDependencies) {
  return yield* Effect.sync(() => {
    const {workspaceFile, workspaceFolders} = workspace;
    const [firstWorkspaceFolder] = workspaceFolders === undefined ? [] : workspaceFolders;

    return (
      workspaceFile !== undefined &&
      workspaceFile.scheme === "untitled" &&
      firstWorkspaceFolder !== undefined &&
      firstWorkspaceFolder.uri.fsPath === anchorFolderPath
    );
  });
});

// True once, the first time it runs on an unsaved anchored workspace; the marker remembers it.
const claimWorkspaceSaveOffer = Effect.fn("WorkspaceInfraService.claimWorkspaceSaveOffer")(
  function* (workspaceDependencies: WorkspaceDependencies) {
    const {anchorFolderPath, fileSystem, path} = workspaceDependencies;
    if (!(yield* isUnsavedAnchoredWorkspace(workspaceDependencies))) return false;
    const markerPath = path.join(path.dirname(anchorFolderPath), SAVE_OFFERED_MARKER);
    if (yield* fileSystem.exists(markerPath)) return false;
    yield* fileSystem.writeFileString(markerPath, "");

    return true;
  },
  Effect.catch((markerError) =>
    Effect.as(Effect.logWarning("Could not check whether the workspace was offered to be saved", markerError), false)
  )
);

// VS Code's Save Workspace As, which asks where; there is no other way to save a workspace.
const saveWorkspaceAs = Effect.fn("WorkspaceInfraService.saveWorkspaceAs")(function* ({
  commands
}: WorkspaceDependencies) {
  yield* Effect.promise(() => commands.executeCommand("workbench.action.saveWorkspaceAs"));
});

const watchWorkspaceFolderChanges = Effect.fn("WorkspaceInfraService.watchWorkspaceFolderChanges")(function* ({
  workspace
}: WorkspaceDependencies) {
  const workspaceFolderEvents = yield* fromEvent(workspace.onDidChangeWorkspaceFolders);

  return Stream.as(workspaceFolderEvents, undefined);
});

const makeWorkspaceInfraService = Effect.fn("WorkspaceInfraService.make")(function* () {
  const workspaceDependencies: WorkspaceDependencies = {
    ...(yield* VsCodeApi),
    anchorFolderPath: yield* getAnchorFolderPath(),
    fileSystem: yield* FileSystem,
    path: yield* Path,
    selectedProjectPath: yield* Ref.make<ProjectPathValueObject | undefined>(undefined)
  };

  return {
    claimWorkspaceSaveOffer: claimWorkspaceSaveOffer(workspaceDependencies),
    listWorkspaceFolderProjects: listWorkspaceFolderProjects(workspaceDependencies),
    removeProjectFolder: (projectPath: ProjectPathValueObject) =>
      removeProjectFolder(workspaceDependencies, projectPath),
    saveWorkspaceAs: saveWorkspaceAs(workspaceDependencies),
    showOnlyProjectFolder: (projectPath: ProjectPathValueObject) =>
      showOnlyProjectFolder(workspaceDependencies, projectPath),
    workspaceFolderChanges: yield* watchWorkspaceFolderChanges(workspaceDependencies)
  };
});

export const WorkspaceInfraService = Layer.effect(IWorkspaceInfraService, makeWorkspaceInfraService());
