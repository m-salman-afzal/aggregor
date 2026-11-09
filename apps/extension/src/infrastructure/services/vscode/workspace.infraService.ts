import {getAnchorFolderPath} from "@infraUtils/anchorFolder.utils.ts";
import {IWorkspaceInfraService, NoSessionToReopenError} from "@interfaces/workspace.infraService.interface.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Clock, Effect, Layer, Ref, Schema, Stream} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {WorkspaceFolderProject} from "@interfaces/workspace.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
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

// Aggregor's own workspace file: its folders, the anchor folder then the shown project. VS Code names the window after
// the file, Aggregor, and never asks to save it.
const AggregorWorkspaceJson = Schema.fromJsonString(
  Schema.Struct({folders: Schema.Array(Schema.Struct({path: Schema.String}))})
);

// The session the window was showing when it reloaded to open Aggregor's workspace, and when that was.
const SessionToReopenJson = Schema.fromJsonString(
  Schema.Struct({sessionId: EntityIdValueObjectSchema, writtenAt: Schema.Finite})
);

// Beside the anchor folder.
const AGGREGOR_WORKSPACE_FILE_NAME = "Aggregor.code-workspace";
const SESSION_TO_REOPEN_FILE_NAME = "sessionToReopen.json";

// A reload takes seconds; an older session to reopen is left from a window that didn't reload, as when VS Code showed
// another window that already had Aggregor's workspace open.
const SESSION_TO_REOPEN_LIFETIME_MS = 60_000;

// Extensions that work in one workspace folder and take folder 0, the anchor folder, until told otherwise, with the
// command that tells them.
const FOLDER_SELECT_COMMANDS = [{command: "mise.selectWorkspaceFolder", extensionId: "hverlin.mise-vscode"}] as const;

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

// A saved workspace whose folder 0 is the anchor folder: Aggregor's own, or one the user saved.
const isSavedAnchoredWorkspace = Effect.fn("WorkspaceInfraService.isSavedAnchoredWorkspace")(function* ({
  anchorFolderPath,
  workspace
}: WorkspaceDependencies) {
  return yield* Effect.sync(() => {
    const {workspaceFile, workspaceFolders} = workspace;
    const [firstWorkspaceFolder] = workspaceFolders === undefined ? [] : workspaceFolders;

    return (
      workspaceFile !== undefined &&
      workspaceFile.scheme === "file" &&
      firstWorkspaceFolder !== undefined &&
      firstWorkspaceFolder.uri.fsPath === anchorFolderPath
    );
  });
});

// Kept beside the anchor folder for the reloaded window, which opens the session again.
const writeSessionToReopen = Effect.fn("WorkspaceInfraService.writeSessionToReopen")(function* (
  {anchorFolderPath, fileSystem, path}: WorkspaceDependencies,
  sessionToReopen: EntityIdValueObject
) {
  const writtenAt = yield* Clock.currentTimeMillis;
  const sessionToReopenText = yield* Schema.encodeEffect(SessionToReopenJson)({sessionId: sessionToReopen, writtenAt});

  yield* fileSystem.writeFileString(
    path.join(path.dirname(anchorFolderPath), SESSION_TO_REOPEN_FILE_NAME),
    sessionToReopenText
  );
});

// Writes Aggregor's workspace file with the project, then opens it in this window, which reloads it. VS Code shows
// another window instead when that one already has the file open.
const openAggregorWorkspace = Effect.fn("WorkspaceInfraService.openAggregorWorkspace")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject,
  sessionToReopen: EntityIdValueObject | undefined
) {
  const {anchorFolderPath, commands, fileSystem, path, Uri} = workspaceDependencies;
  const workspaceFilePath = path.join(path.dirname(anchorFolderPath), AGGREGOR_WORKSPACE_FILE_NAME);
  const folders = [{path: anchorFolderPath}, {path: projectPath}];
  const workspaceFileText = yield* Schema.encodeEffect(AggregorWorkspaceJson)({folders});
  yield* fileSystem.writeFileString(workspaceFilePath, workspaceFileText);
  if (sessionToReopen !== undefined) yield* writeSessionToReopen(workspaceDependencies, sessionToReopen);

  yield* Effect.promise(() =>
    commands.executeCommand("vscode.openFolder", Uri.file(workspaceFilePath), {forceReuseWindow: true})
  );
});

// Writes the anchor folder's settings for the project, then swaps it in at folder 1 of a saved anchored workspace, or
// opens Aggregor's workspace with it.
const moveProjectFolderIn = Effect.fn("WorkspaceInfraService.moveProjectFolderIn")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject,
  sessionToReopen: EntityIdValueObject | undefined
) {
  yield* writeAnchorFolderSettings(workspaceDependencies, projectPath);
  if (!(yield* isSavedAnchoredWorkspace(workspaceDependencies)))
    return yield* openAggregorWorkspace(workspaceDependencies, projectPath, sessionToReopen);
  const workspaceFolderPaths = yield* readWorkspaceFolderPaths(workspaceDependencies);
  const projectFolder: WorkspaceFolderToAdd = {uri: workspaceDependencies.Uri.file(projectPath)};

  return yield* updateWorkspaceFolders(workspaceDependencies, {
    deleteCount: workspaceFolderPaths.length - 1,
    foldersToAdd: [projectFolder],
    start: 1
  });
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
  function* (
    workspaceDependencies: WorkspaceDependencies,
    projectPath: ProjectPathValueObject,
    sessionToReopen: EntityIdValueObject | undefined
  ) {
    const workspaceFolderPaths = yield* readWorkspaceFolderPaths(workspaceDependencies);
    const projectFolderPaths = Array.filter(
      workspaceFolderPaths,
      (folderPath) => folderPath !== workspaceDependencies.anchorFolderPath
    );
    const isProjectShownAlone = projectFolderPaths.length === 1 && projectFolderPaths[0] === projectPath;
    if (!isProjectShownAlone) yield* moveProjectFolderIn(workspaceDependencies, projectPath, sessionToReopen);

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

// Read and deleted, so the session opens once; any failure means there is none.
const takeSessionToReopen = Effect.fn("WorkspaceInfraService.takeSessionToReopen")(
  function* ({anchorFolderPath, fileSystem, path}: WorkspaceDependencies) {
    const sessionToReopenPath = path.join(path.dirname(anchorFolderPath), SESSION_TO_REOPEN_FILE_NAME);
    const sessionToReopenText = yield* fileSystem.readFileString(sessionToReopenPath);
    yield* fileSystem.remove(sessionToReopenPath);
    const {sessionId, writtenAt} = yield* Schema.decodeEffect(SessionToReopenJson)(sessionToReopenText);
    const now = yield* Clock.currentTimeMillis;
    if (now - writtenAt > SESSION_TO_REOPEN_LIFETIME_MS) return yield* NoSessionToReopenError.make();

    return sessionId;
  },
  Effect.mapError(() => NoSessionToReopenError.make())
);

const watchWorkspaceFolderChanges = Effect.fn("WorkspaceInfraService.watchWorkspaceFolderChanges")(function* ({
  workspace
}: WorkspaceDependencies) {
  const workspaceFolderEvents = yield* streamVsCodeEvent(workspace.onDidChangeWorkspaceFolders);

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
    listWorkspaceFolderProjects: listWorkspaceFolderProjects(workspaceDependencies),
    removeProjectFolder: (projectPath: ProjectPathValueObject) =>
      removeProjectFolder(workspaceDependencies, projectPath),
    showOnlyProjectFolder: (projectPath: ProjectPathValueObject, sessionToReopen: EntityIdValueObject | undefined) =>
      showOnlyProjectFolder(workspaceDependencies, projectPath, sessionToReopen),
    takeSessionToReopen: takeSessionToReopen(workspaceDependencies),
    workspaceFolderChanges: yield* watchWorkspaceFolderChanges(workspaceDependencies)
  };
});

export const WorkspaceInfraService = Layer.effect(IWorkspaceInfraService, makeWorkspaceInfraService());
