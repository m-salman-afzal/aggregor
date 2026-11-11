import {getAnchorFolderPath} from "@infraUtils/anchorFolder.utils.ts";
import {IWorkspaceInfraService, NoSessionToReopenError} from "@interfaces/workspace.infraService.interface.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {
  AGGREGOR_WORKSPACE,
  ANCHOR_FOLDER_SETTINGS,
  FOLDER_SELECT_COMMANDS,
  FOLDER_SETTINGS_FILE,
  PROJECT_SETTINGS_SYNC,
  SESSION_TO_REOPEN,
  WORKSPACE_FOLDERS_UPDATE_TIMEOUT
} from "@pkg/constants/src/workspace.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {
  Array,
  Clock,
  Effect,
  Equal,
  Layer,
  Predicate,
  Record,
  Ref,
  Result,
  Schema,
  Semaphore,
  Stream,
  String
} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {applyEdits, modify, parse} from "jsonc-parser";

import type {WorkspaceFolderProject} from "@interfaces/workspace.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {ParseError} from "jsonc-parser";
import type {TextDocument, Uri} from "vscode";

// What the workspace functions share: VS Code's workspace and Uri, the file system, the anchor folder and the files
// beside it, and the lock that keeps project settings syncs and switches one at a time.
type WorkspaceDependencies = {
  readonly aggregorWorkspaceFilePath: string;
  readonly anchorFolderPath: string;
  readonly copiedProjectSettingsFilePath: string;
  readonly fileSystem: FileSystem;
  readonly path: Path;
  readonly projectSettingsLock: Semaphore.Semaphore;
  // The project the extensions in FOLDER_SELECT_COMMANDS were last told about.
  readonly selectedProjectPath: Ref.Ref<ProjectPathValueObject | undefined>;
} & Pick<VsCodeApi["Service"], "commands" | "extensions" | "Range" | "Uri" | "workspace" | "WorkspaceEdit">;

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
// No settings were copied into the workspace file yet, or the file that says which is unreadable.
class NoCopiedProjectSettingsError extends Schema.TaggedError<
  NoCopiedProjectSettingsError,
  {readonly brand: unique symbol}
>()("NoCopiedProjectSettingsError", {}) {}
// VS Code couldn't open the settings file, apply the edit or save it.
class SettingsFileNotWrittenError extends Schema.TaggedError<
  SettingsFileNotWrittenError,
  {readonly brand: unique symbol}
>()("SettingsFileNotWrittenError", {settingsFilePath: Schema.String}) {}
// The settings file isn't JSON with comments, as while it is being edited.
class SettingsFileUnreadableError extends Schema.TaggedError<
  SettingsFileUnreadableError,
  {readonly brand: unique symbol}
>()("SettingsFileUnreadableError", {settingsFilePath: Schema.String}) {}
// The settings file has unsaved changes in an editor; the sync after they are saved writes it.
class SettingsFileUnsavedError extends Schema.TaggedError<SettingsFileUnsavedError, {readonly brand: unique symbol}>()(
  "SettingsFileUnsavedError",
  {settingsFilePath: Schema.String}
) {}
class WorkspaceFoldersUpdateRejectedError extends Schema.TaggedError<
  WorkspaceFoldersUpdateRejectedError,
  {readonly brand: unique symbol}
>()("WorkspaceFoldersUpdateRejectedError", {}) {}

// A settings file's settings, by key.
const FolderSettingsSchema = Schema.Record(Schema.String, Schema.Unknown);
type FolderSettings = typeof FolderSettingsSchema.Type;
const isFolderSettings = Schema.is(FolderSettingsSchema);

// The settings last copied into the workspace file, and the project they came from: what each side is compared with to
// tell an edit on one side from one on the other.
const CopiedProjectSettingsJson = Schema.fromJsonString(
  Schema.Struct({projectPath: Schema.String, settings: FolderSettingsSchema})
);

const AnchorFolderSettingsJson = Schema.fromJsonString(
  Schema.Struct({
    [ANCHOR_FOLDER_SETTINGS.EXCLUDED_FILES_KEY]: Schema.Record(Schema.String, Schema.Boolean),
    [ANCHOR_FOLDER_SETTINGS.TERMINAL_CWD_KEY]: Schema.String
  })
);

// Aggregor's own workspace file: its folders, the anchor folder then the shown project, and the project's settings. VS
// Code names the window after the file, Aggregor, and never asks to save it.
const AggregorWorkspaceJson = Schema.fromJsonString(
  Schema.Struct({folders: Schema.Array(Schema.Struct({path: Schema.String})), settings: FolderSettingsSchema})
);

// The session the window was showing when it reloaded to open Aggregor's workspace, and when that was.
const SessionToReopenJson = Schema.fromJsonString(
  Schema.Struct({sessionId: EntityIdValueObjectSchema, writtenAt: Schema.Finite})
);

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
const updateWorkspaceFolders = Effect.fn("WorkspaceInfraService.updateWorkspaceFolders")(function* (
  {workspace}: WorkspaceDependencies,
  {deleteCount, foldersToAdd, start}: WorkspaceFoldersSplice
) {
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
}, Effect.timeout(WORKSPACE_FOLDERS_UPDATE_TIMEOUT));

// Written before every switch, which also brings back a deleted or edited copy.
const writeAnchorFolderSettings = Effect.fn("WorkspaceInfraService.writeAnchorFolderSettings")(function* (
  {anchorFolderPath, fileSystem, path}: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  const settingsDirectoryPath = path.join(anchorFolderPath, FOLDER_SETTINGS_FILE.FOLDER_NAME);
  const settingsJson = yield* Schema.encodeEffect(AnchorFolderSettingsJson)({
    [ANCHOR_FOLDER_SETTINGS.EXCLUDED_FILES_KEY]: {[ANCHOR_FOLDER_SETTINGS.EVERY_FILE_PATTERN]: true},
    [ANCHOR_FOLDER_SETTINGS.TERMINAL_CWD_KEY]: projectPath
  });
  yield* fileSystem.makeDirectory(settingsDirectoryPath, {recursive: true});
  yield* fileSystem.writeFileString(path.join(settingsDirectoryPath, FOLDER_SETTINGS_FILE.FILE_NAME), settingsJson);
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
    path.join(path.dirname(anchorFolderPath), SESSION_TO_REOPEN.FILE_NAME),
    sessionToReopenText
  );
});

// The project's own settings file, in its .vscode folder.
const findProjectSettingsFilePath = Effect.fn("WorkspaceInfraService.findProjectSettingsFilePath")(function* (
  {path}: WorkspaceDependencies,
  projectPath: string
) {
  return yield* Effect.sync(() =>
    path.join(projectPath, FOLDER_SETTINGS_FILE.FOLDER_NAME, FOLDER_SETTINGS_FILE.FILE_NAME)
  );
});

// Settings text, which allows comments and trailing commas, as settings by key.
const parseSettingsText = Effect.fn("WorkspaceInfraService.parseSettingsText")(function* (
  settingsText: string,
  settingsFilePath: string
) {
  const parseErrors: ParseError[] = [];
  const parsedSettings: unknown = parse(settingsText, parseErrors, {allowTrailingComma: true});
  if (parseErrors.length > 0) return yield* SettingsFileUnreadableError.make({settingsFilePath});

  return yield* Schema.decodeUnknownEffect(FolderSettingsSchema)(parsedSettings);
});

// A project without a settings file has no settings.
const readProjectSettings = Effect.fn("WorkspaceInfraService.readProjectSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string
) {
  const {fileSystem} = workspaceDependencies;
  const settingsFilePath = yield* findProjectSettingsFilePath(workspaceDependencies, projectPath);
  if (!(yield* fileSystem.exists(settingsFilePath))) return {};
  const settingsText = yield* fileSystem.readFileString(settingsFilePath);

  return yield* parseSettingsText(settingsText, settingsFilePath);
});

// What the workspace file holds now: the last copy, with whatever VS Code or an extension has written there since.
const readWorkspaceFileSettings = Effect.fn("WorkspaceInfraService.readWorkspaceFileSettings")(function* ({
  aggregorWorkspaceFilePath,
  fileSystem
}: WorkspaceDependencies) {
  const workspaceFileText = yield* fileSystem.readFileString(aggregorWorkspaceFilePath);
  const workspaceFile = yield* parseSettingsText(workspaceFileText, aggregorWorkspaceFilePath);
  const workspaceSettings = workspaceFile[PROJECT_SETTINGS_SYNC.WORKSPACE_FILE_SETTINGS_KEY];

  return isFolderSettings(workspaceSettings) ? workspaceSettings : {};
});

// Every string in the settings, in arrays and nested objects too, through mapSettingText.
const mapSettingTexts = Effect.fn("WorkspaceInfraService.mapSettingTexts")(function* (
  folderSettings: FolderSettings,
  mapSettingText: (settingText: string) => string
) {
  const mapSettingValue = (settingValue: unknown): unknown => {
    if (Predicate.isString(settingValue)) return mapSettingText(settingValue);
    if (Array.isArray(settingValue)) return Array.map(settingValue, mapSettingValue);
    if (isFolderSettings(settingValue)) return Record.map(settingValue, mapSettingValue);

    return settingValue;
  };

  return yield* Effect.sync(() => Record.map(folderSettings, mapSettingValue));
});

// The copy names the project wherever the project's own file did: in the workspace file, a relative path or a folder
// variable would name the anchor folder.
const resolveProjectSettings = Effect.fn("WorkspaceInfraService.resolveProjectSettings")(function* (
  {path}: WorkspaceDependencies,
  projectPath: string,
  projectSettings: FolderSettings
) {
  // Split and joined rather than replaced, so a `$` in the project's path is kept as it is.
  const replaceVariable = (settingText: string, variable: string, variableValue: string) =>
    Array.join(String.split(settingText, variable), variableValue);

  return yield* mapSettingTexts(projectSettings, (settingText) => {
    const withProjectFolder = replaceVariable(
      replaceVariable(
        settingText,
        PROJECT_SETTINGS_SYNC.WORKSPACE_FOLDER_BASENAME_VARIABLE,
        path.basename(projectPath)
      ),
      PROJECT_SETTINGS_SYNC.WORKSPACE_FOLDER_VARIABLE,
      projectPath
    );
    const isRelativePath = Array.some(PROJECT_SETTINGS_SYNC.RELATIVE_PATH_PREFIXES, (relativePathPrefix) =>
      String.startsWith(relativePathPrefix)(withProjectFolder)
    );

    return isRelativePath ? path.resolve(projectPath, withProjectFolder) : withProjectFolder;
  });
});

// VS Code and extensions write a relative path in the workspace file from the workspace file's folder; the project's
// own file has it from the project's folder.
const rebaseWorkspaceEdits = Effect.fn("WorkspaceInfraService.rebaseWorkspaceEdits")(function* (
  {aggregorWorkspaceFilePath, path}: WorkspaceDependencies,
  projectPath: string,
  workspaceEdits: FolderSettings
) {
  return yield* mapSettingTexts(workspaceEdits, (settingText) => {
    const isRelativePath = Array.some(PROJECT_SETTINGS_SYNC.RELATIVE_PATH_PREFIXES, (relativePathPrefix) =>
      String.startsWith(relativePathPrefix)(settingText)
    );
    if (!isRelativePath) return settingText;
    const absolutePath = path.resolve(path.dirname(aggregorWorkspaceFilePath), settingText);
    const projectRelativePath = path.relative(projectPath, absolutePath);

    return String.startsWith(PROJECT_SETTINGS_SYNC.PARENT_FOLDER)(projectRelativePath)
      ? projectRelativePath
      : `${PROJECT_SETTINGS_SYNC.CURRENT_FOLDER}${projectRelativePath}`;
  });
});

const prepareWorkspaceSettings = Effect.fn("WorkspaceInfraService.prepareWorkspaceSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string
) {
  const projectSettings = yield* readProjectSettings(workspaceDependencies, projectPath);

  return yield* resolveProjectSettings(workspaceDependencies, projectPath, projectSettings);
});

// A setting changed only in the workspace file since the last copy: VS Code or an extension wrote it there.
const findWorkspaceEditedKeys = Effect.fn("WorkspaceInfraService.findWorkspaceEditedKeys")(function* (
  workspaceSettings: FolderSettings,
  projectSettings: FolderSettings,
  copiedSettings: FolderSettings
) {
  return yield* Effect.sync(() => {
    const settingKeys = Array.dedupe([
      ...Record.keys(workspaceSettings),
      ...Record.keys(projectSettings),
      ...Record.keys(copiedSettings)
    ]);

    return Array.filter(
      settingKeys,
      (settingKey) =>
        Equal.equals(projectSettings[settingKey], copiedSettings[settingKey]) &&
        !Equal.equals(workspaceSettings[settingKey], copiedSettings[settingKey])
    );
  });
});

// A setting changed in the project's file since the last copy takes the project's value. One changed only in the
// workspace file keeps it there and becomes a workspace edit for the project's file, as VS Code would have written it
// there with the project open alone; an undefined value removes it.
const mergeProjectSettings = Effect.fn("WorkspaceInfraService.mergeProjectSettings")(function* (
  workspaceSettings: FolderSettings,
  projectSettings: FolderSettings,
  copiedSettings: FolderSettings
) {
  const workspaceEditedKeys = yield* findWorkspaceEditedKeys(workspaceSettings, projectSettings, copiedSettings);
  const workspaceEdits: FolderSettings = Record.fromEntries(
    Array.map(workspaceEditedKeys, (settingKey) => [settingKey, workspaceSettings[settingKey]] as const)
  );
  const projectSettingsKeptInWorkspace = Record.filter(
    projectSettings,
    (_settingValue, settingKey) => !Array.contains(workspaceEditedKeys, settingKey)
  );
  const mergedSettings = Record.filter(
    {...projectSettingsKeptInWorkspace, ...workspaceEdits},
    (settingValue) => settingValue !== undefined
  );

  return {mergedSettings, workspaceEdits};
});

// The settings text with one setting set, or removed for an undefined value, indented as the file already is.
const editSettingInText = Effect.fn("WorkspaceInfraService.editSettingInText")(function* (
  settingsText: string,
  settingKey: string,
  settingValue: unknown
) {
  const indentationMatch = Result.fromOption(
    String.match(PROJECT_SETTINGS_SYNC.INDENTATION_PATTERN)(settingsText),
    () => undefined
  );
  const {indentation = PROJECT_SETTINGS_SYNC.DEFAULT_INDENTATION} =
    Result.isFailure(indentationMatch) || indentationMatch.success.groups === undefined
      ? {}
      : indentationMatch.success.groups;
  const isTabIndented = String.startsWith(PROJECT_SETTINGS_SYNC.TAB)(indentation);
  const formattingOptions = {
    insertSpaces: !isTabIndented,
    tabSize: isTabIndented ? PROJECT_SETTINGS_SYNC.TAB_SIZE : indentation.length
  };

  return yield* Effect.sync(() =>
    applyEdits(settingsText, modify(settingsText, [settingKey], settingValue, {formattingOptions}))
  );
});

// Through VS Code's own copy of the file, which its settings writes share with every extension's, so none of them finds
// the file changed under it. A file with unsaved changes in an editor is left alone, as VS Code's own writes leave it.
const openSettingsDocument = Effect.fn("WorkspaceInfraService.openSettingsDocument")(function* (
  {Uri, workspace}: WorkspaceDependencies,
  settingsFilePath: string
) {
  const settingsDocument = yield* Effect.tryPromise({
    catch: () => SettingsFileNotWrittenError.make({settingsFilePath}),
    try: () => workspace.openTextDocument(Uri.file(settingsFilePath))
  });
  if (settingsDocument.isDirty) return yield* SettingsFileUnsavedError.make({settingsFilePath});

  return settingsDocument;
});

// One edit that replaces the whole text, then a save, so the file changes once. Gives back the saved document.
const saveSettingsDocumentText = Effect.fn("WorkspaceInfraService.saveSettingsDocumentText")(function* (
  {Range, workspace, WorkspaceEdit}: WorkspaceDependencies,
  settingsDocument: TextDocument,
  editedSettingsText: string
) {
  const settingsEdit = new WorkspaceEdit();
  const wholeText = new Range(
    settingsDocument.positionAt(0),
    settingsDocument.positionAt(settingsDocument.getText().length)
  );
  settingsEdit.replace(settingsDocument.uri, wholeText, editedSettingsText);
  const isEditApplied = yield* Effect.promise(() => workspace.applyEdit(settingsEdit));
  const isSaved = isEditApplied && (yield* Effect.promise(() => settingsDocument.save()));
  if (!isSaved) return yield* SettingsFileNotWrittenError.make({settingsFilePath: settingsDocument.uri.fsPath});

  return settingsDocument;
});

const editSettingsFile = Effect.fn("WorkspaceInfraService.editSettingsFile")(function* (
  workspaceDependencies: WorkspaceDependencies,
  settingsFilePath: string,
  editSettingsText: (settingsText: string) => Effect.Effect<string>
) {
  const settingsDocument = yield* openSettingsDocument(workspaceDependencies, settingsFilePath);
  const settingsText = settingsDocument.getText();
  const editedSettingsText = yield* editSettingsText(settingsText);
  if (editedSettingsText !== settingsText)
    yield* saveSettingsDocumentText(workspaceDependencies, settingsDocument, editedSettingsText);
});

// Only the settings change, so the folders VS Code wrote stay as they are.
const writeWorkspaceFileSettings = Effect.fn("WorkspaceInfraService.writeWorkspaceFileSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  workspaceSettings: FolderSettings
) {
  yield* editSettingsFile(workspaceDependencies, workspaceDependencies.aggregorWorkspaceFilePath, (workspaceFileText) =>
    editSettingInText(workspaceFileText, PROJECT_SETTINGS_SYNC.WORKSPACE_FILE_SETTINGS_KEY, workspaceSettings)
  );
});

// Each workspace edit goes into the project's own file, which the first one creates.
const writeWorkspaceEditsToProject = Effect.fn("WorkspaceInfraService.writeWorkspaceEditsToProject")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string,
  workspaceEdits: FolderSettings
) {
  if (Record.isEmptyRecord(workspaceEdits)) return;
  const {fileSystem, path} = workspaceDependencies;
  const settingsFilePath = yield* findProjectSettingsFilePath(workspaceDependencies, projectPath);
  const projectSettingEdits = yield* rebaseWorkspaceEdits(workspaceDependencies, projectPath, workspaceEdits);
  if (!(yield* fileSystem.exists(settingsFilePath))) {
    yield* fileSystem.makeDirectory(path.dirname(settingsFilePath), {recursive: true});
    yield* fileSystem.writeFileString(settingsFilePath, PROJECT_SETTINGS_SYNC.EMPTY_SETTINGS_TEXT);
  }

  yield* editSettingsFile(workspaceDependencies, settingsFilePath, (settingsText) =>
    Effect.reduce(
      Record.toEntries(projectSettingEdits),
      () => settingsText,
      (editedSettingsText, [settingKey, settingValue]) =>
        editSettingInText(editedSettingsText, settingKey, settingValue)
    )
  );
});

const readCopiedProjectSettings = Effect.fn("WorkspaceInfraService.readCopiedProjectSettings")(
  function* ({copiedProjectSettingsFilePath, fileSystem}: WorkspaceDependencies) {
    const copiedProjectSettingsText = yield* fileSystem.readFileString(copiedProjectSettingsFilePath);

    return yield* Schema.decodeEffect(CopiedProjectSettingsJson)(copiedProjectSettingsText);
  },
  Effect.mapError(() => NoCopiedProjectSettingsError.make())
);

const writeCopiedProjectSettings = Effect.fn("WorkspaceInfraService.writeCopiedProjectSettings")(function* (
  {copiedProjectSettingsFilePath, fileSystem}: WorkspaceDependencies,
  projectPath: string,
  copiedSettings: FolderSettings
) {
  const copiedProjectSettingsText = yield* Schema.encodeEffect(CopiedProjectSettingsJson)({
    projectPath,
    settings: copiedSettings
  });

  yield* fileSystem.writeFileString(copiedProjectSettingsFilePath, copiedProjectSettingsText);
});

// The project's own file and the workspace file meet again: each side's edits since the last copy reach the other. With
// no last copy of this project, as right after a switch, the project's settings replace the workspace file's. Edits go
// to the project first, so a failure there leaves them in the workspace file for the next sync.
const syncProjectSettings = Effect.fn("WorkspaceInfraService.syncProjectSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string
) {
  const projectSettings = yield* prepareWorkspaceSettings(workspaceDependencies, projectPath);
  const workspaceSettings = yield* readWorkspaceFileSettings(workspaceDependencies);
  const copiedProjectSettings = yield* Effect.result(readCopiedProjectSettings(workspaceDependencies));
  const isProjectCopied =
    Result.isSuccess(copiedProjectSettings) && copiedProjectSettings.success.projectPath === projectPath;
  const copiedSettings = isProjectCopied ? copiedProjectSettings.success.settings : projectSettings;
  const {mergedSettings, workspaceEdits} = isProjectCopied
    ? yield* mergeProjectSettings(workspaceSettings, projectSettings, copiedSettings)
    : {mergedSettings: projectSettings, workspaceEdits: {}};
  yield* writeWorkspaceEditsToProject(workspaceDependencies, projectPath, workspaceEdits);
  if (!Equal.equals(mergedSettings, workspaceSettings))
    yield* writeWorkspaceFileSettings(workspaceDependencies, mergedSettings);
  if (!isProjectCopied || !Equal.equals(mergedSettings, copiedSettings))
    yield* writeCopiedProjectSettings(workspaceDependencies, projectPath, mergedSettings);
});

const isAggregorWorkspaceOpen = Effect.fn("WorkspaceInfraService.isAggregorWorkspaceOpen")(function* ({
  aggregorWorkspaceFilePath,
  workspace
}: WorkspaceDependencies) {
  return yield* Effect.sync(() => {
    const {workspaceFile} = workspace;

    return (
      workspaceFile !== undefined &&
      workspaceFile.scheme === "file" &&
      workspaceFile.fsPath === aggregorWorkspaceFilePath
    );
  });
});

// Only while Aggregor's workspace shows one project. A failure leaves both sides, edits included, for the next sync.
const syncShownProjectSettings = Effect.fn("WorkspaceInfraService.syncShownProjectSettings")(
  function* (workspaceDependencies: WorkspaceDependencies) {
    if (!(yield* isAggregorWorkspaceOpen(workspaceDependencies))) return;
    const workspaceFolderProjects = yield* listWorkspaceFolderProjects(workspaceDependencies);
    const [shownProject] = workspaceFolderProjects;
    if (workspaceFolderProjects.length !== 1 || shownProject === undefined) return;

    yield* syncProjectSettings(workspaceDependencies, shownProject.path);
  },
  Effect.ignore({log: "Warn", message: "Could not sync the project's settings with Aggregor's workspace"})
);

// One sync at a time, and none while a switch runs.
const syncShownProjectSettingsInTurn = Effect.fn("WorkspaceInfraService.syncShownProjectSettingsInTurn")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  yield* Semaphore.withPermits(
    workspaceDependencies.projectSettingsLock,
    1
  )(syncShownProjectSettings(workspaceDependencies));
});

// A workspace folder's own settings file: not the anchor folder's, nor one nested deeper in a project.
const isProjectSettingsFile = Effect.fn("WorkspaceInfraService.isProjectSettingsFile")(function* (
  workspaceDependencies: WorkspaceDependencies,
  changedFileUri: Uri
) {
  const workspaceFolderProjects = yield* listWorkspaceFolderProjects(workspaceDependencies);
  const projectSettingsFilePaths = yield* Effect.forEach(workspaceFolderProjects, (workspaceFolderProject) =>
    findProjectSettingsFilePath(workspaceDependencies, workspaceFolderProject.path)
  );

  return Array.contains(projectSettingsFilePaths, changedFileUri.fsPath);
});

const streamProjectSettingsFileChanges = Effect.fn("WorkspaceInfraService.streamProjectSettingsFileChanges")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  const settingsFileWatcher = yield* acquireScopedDisposable(() =>
    workspaceDependencies.workspace.createFileSystemWatcher(FOLDER_SETTINGS_FILE.WATCH_PATTERN)
  );
  const settingsFileChanges = Stream.mergeAll(
    [
      yield* streamVsCodeEvent(settingsFileWatcher.onDidCreate),
      yield* streamVsCodeEvent(settingsFileWatcher.onDidChange),
      yield* streamVsCodeEvent(settingsFileWatcher.onDidDelete)
    ],
    {concurrency: "unbounded"}
  );

  return Stream.filterEffect(settingsFileChanges, (changedFileUri) =>
    isProjectSettingsFile(workspaceDependencies, changedFileUri)
  );
});

// A sync follows each edit on either side: the project's settings file changing, VS Code writing any settings, which
// an extension such as Peacock does in the workspace file, and the folders changing.
const watchProjectSettingsChanges = Effect.fn("WorkspaceInfraService.watchProjectSettingsChanges")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  const {workspace} = workspaceDependencies;
  const projectSettingsFileChanges = yield* streamProjectSettingsFileChanges(workspaceDependencies);
  const configChanges = yield* streamVsCodeEvent(workspace.onDidChangeConfiguration);
  const workspaceFolderChanges = yield* streamVsCodeEvent(workspace.onDidChangeWorkspaceFolders);
  const syncTriggers = Stream.mergeAll(
    [
      Stream.as(projectSettingsFileChanges, undefined),
      Stream.as(configChanges, undefined),
      Stream.as(workspaceFolderChanges, undefined)
    ],
    {concurrency: "unbounded"}
  );

  yield* syncShownProjectSettingsInTurn(workspaceDependencies);
  yield* Stream.runForEach(syncTriggers, () => syncShownProjectSettingsInTurn(workspaceDependencies));
});

// Edits an earlier window left in the workspace file reach their project before the file is written anew.
const syncCopiedProjectSettings = Effect.fn("WorkspaceInfraService.syncCopiedProjectSettings")(
  function* (workspaceDependencies: WorkspaceDependencies) {
    const {projectPath} = yield* readCopiedProjectSettings(workspaceDependencies);

    yield* syncProjectSettings(workspaceDependencies, projectPath);
  },
  Effect.catchTag("NoCopiedProjectSettingsError", () => Effect.void),
  Effect.ignore({
    log: "Warn",
    message: "Could not sync the last project's settings before opening Aggregor's workspace"
  })
);

// The window opens the workspace even when the project's settings can't be read; the next sync copies them.
const prepareOpeningWorkspaceSettings = Effect.fn("WorkspaceInfraService.prepareOpeningWorkspaceSettings")(
  function* (workspaceDependencies: WorkspaceDependencies, projectPath: ProjectPathValueObject) {
    return yield* prepareWorkspaceSettings(workspaceDependencies, projectPath);
  },
  Effect.catch((settingsError) =>
    Effect.as(Effect.logWarning("Could not read the project's settings", settingsError), {})
  )
);

// Writes Aggregor's workspace file with the project and its settings, then opens it in this window, which reloads it.
// VS Code shows another window instead when that one already has the file open.
const openAggregorWorkspace = Effect.fn("WorkspaceInfraService.openAggregorWorkspace")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject,
  sessionToReopen: EntityIdValueObject | undefined
) {
  const {aggregorWorkspaceFilePath, anchorFolderPath, commands, fileSystem, Uri} = workspaceDependencies;
  yield* syncCopiedProjectSettings(workspaceDependencies);
  const settings = yield* prepareOpeningWorkspaceSettings(workspaceDependencies, projectPath);
  const folders = [{path: anchorFolderPath}, {path: projectPath}];
  const workspaceFileText = yield* Schema.encodeEffect(AggregorWorkspaceJson)({folders, settings});
  yield* fileSystem.writeFileString(aggregorWorkspaceFilePath, workspaceFileText);
  yield* writeCopiedProjectSettings(workspaceDependencies, projectPath, settings);
  if (sessionToReopen !== undefined) yield* writeSessionToReopen(workspaceDependencies, sessionToReopen);

  yield* Effect.promise(() =>
    commands.executeCommand(VS_CODE_COMMANDS.OPEN_FOLDER, Uri.file(aggregorWorkspaceFilePath), {
      forceReuseWindow: true
    })
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

// The next project's settings come in before its folder does, in one write. The folder change makes Peacock apply the
// color it reads then; finding the old project's, it would race the copy, and its writes would trade the two colors back
// and forth for good.
const copyProjectSettingsIn = Effect.fn("WorkspaceInfraService.copyProjectSettingsIn")(
  function* (workspaceDependencies: WorkspaceDependencies, projectPath: ProjectPathValueObject) {
    if (!(yield* isAggregorWorkspaceOpen(workspaceDependencies))) return;
    const projectSettings = yield* prepareWorkspaceSettings(workspaceDependencies, projectPath);
    yield* writeWorkspaceFileSettings(workspaceDependencies, projectSettings);

    yield* writeCopiedProjectSettings(workspaceDependencies, projectPath, projectSettings);
  },
  Effect.ignore({log: "Warn", message: "Could not copy the next project's settings into Aggregor's workspace"})
);

// The shown project's workspace edits reach it before it leaves, and the next project's settings come in before it
// does; the sync once it is in sends any edit an extension made on its arrival back to it.
const switchShownProject = Effect.fn("WorkspaceInfraService.switchShownProject")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject,
  sessionToReopen: EntityIdValueObject | undefined
) {
  yield* syncShownProjectSettings(workspaceDependencies);
  yield* copyProjectSettingsIn(workspaceDependencies, projectPath);
  yield* moveProjectFolderIn(workspaceDependencies, projectPath, sessionToReopen);
  yield* syncShownProjectSettings(workspaceDependencies);
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
    if (!isProjectShownAlone)
      yield* Semaphore.withPermits(
        workspaceDependencies.projectSettingsLock,
        1
      )(switchShownProject(workspaceDependencies, projectPath, sessionToReopen));

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
    const sessionToReopenPath = path.join(path.dirname(anchorFolderPath), SESSION_TO_REOPEN.FILE_NAME);
    const sessionToReopenText = yield* fileSystem.readFileString(sessionToReopenPath);
    yield* fileSystem.remove(sessionToReopenPath);
    const {sessionId, writtenAt} = yield* Schema.decodeEffect(SessionToReopenJson)(sessionToReopenText);
    const now = yield* Clock.currentTimeMillis;
    if (now - writtenAt > SESSION_TO_REOPEN.LIFETIME_MS) return yield* NoSessionToReopenError.make();

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
  const anchorFolderPath = yield* getAnchorFolderPath();
  const path = yield* Path;
  const workspaceDependencies: WorkspaceDependencies = {
    ...(yield* VsCodeApi),
    aggregorWorkspaceFilePath: path.join(path.dirname(anchorFolderPath), AGGREGOR_WORKSPACE.WORKSPACE_FILE_NAME),
    anchorFolderPath,
    copiedProjectSettingsFilePath: path.join(
      path.dirname(anchorFolderPath),
      PROJECT_SETTINGS_SYNC.COPIED_SETTINGS_FILE_NAME
    ),
    fileSystem: yield* FileSystem,
    path,
    projectSettingsLock: yield* Semaphore.make(1),
    selectedProjectPath: yield* Ref.make<ProjectPathValueObject | undefined>(undefined)
  };
  yield* Effect.forkScoped(watchProjectSettingsChanges(workspaceDependencies));

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
