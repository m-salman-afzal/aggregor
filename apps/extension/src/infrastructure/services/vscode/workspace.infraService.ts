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
  SETTINGS_FILE_WRITE_RETRY,
  WORKSPACE_FOLDERS_CHANGE
} from "@pkg/constants/src/workspace.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {
  Array,
  Clock,
  Deferred,
  Effect,
  Equal,
  Layer,
  Predicate,
  Record,
  Ref,
  Result,
  Schedule,
  Schema,
  Semaphore,
  Stream,
  String
} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {applyEdits, modify, parse, parseTree} from "jsonc-parser";

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

// A folder entry of a workspace file as written, with the absolute path it names.
interface WorkspaceFileFolder {
  readonly folderPath: string;
  readonly writtenFolder: unknown;
}

// A workspace file's text, and its folder entries.
interface WorkspaceFileContents {
  readonly folders: readonly WorkspaceFileFolder[];
  readonly text: string;
}

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
// The next project's settings come in with its folder only in Aggregor's workspace, and only when they can be read.
class NoIncomingProjectSettingsError extends Schema.TaggedError<
  NoIncomingProjectSettingsError,
  {readonly brand: unique symbol}
>()("NoIncomingProjectSettingsError", {}) {}
// The window has no saved workspace file: it shows a folder, or an untitled workspace.
class NoSavedWorkspaceFileError extends Schema.TaggedError<
  NoSavedWorkspaceFileError,
  {readonly brand: unique symbol}
>()("NoSavedWorkspaceFileError", {}) {}
// VS Code refused the edit, as when the file changed after it was read.
class SettingsFileEditRejectedError extends Schema.TaggedError<
  SettingsFileEditRejectedError,
  {readonly brand: unique symbol}
>()("SettingsFileEditRejectedError", {settingsFilePath: Schema.String}) {}
// VS Code couldn't open the settings file.
class SettingsFileNotOpenedError extends Schema.TaggedError<
  SettingsFileNotOpenedError,
  {readonly brand: unique symbol}
>()("SettingsFileNotOpenedError", {cause: Schema.Unknown, settingsFilePath: Schema.String}) {}
// VS Code didn't save the edited settings file, even when asked again; the edit stays unsaved in its copy.
class SettingsFileNotSavedError extends Schema.TaggedError<
  SettingsFileNotSavedError,
  {readonly brand: unique symbol}
>()("SettingsFileNotSavedError", {settingsFilePath: Schema.String}) {}
// The settings file isn't JSON with comments, as while it is being edited.
class SettingsFileUnreadableError extends Schema.TaggedError<
  SettingsFileUnreadableError,
  {readonly brand: unique symbol}
>()("SettingsFileUnreadableError", {settingsFilePath: Schema.String}) {}
// The settings file still has unsaved changes after another writer had time to save them, as an editor's would; the sync
// after they are saved writes it.
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

// The project a switch brings in, with its settings when they come in too.
interface IncomingProject {
  readonly projectPath: ProjectPathValueObject;
  readonly settings: Result.Result<FolderSettings, NoIncomingProjectSettingsError>;
}

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
  Schema.Struct({folders: Schema.Array(Schema.Struct({path: Schema.String})), settings: FolderSettingsSchema}),
  {space: PROJECT_SETTINGS_SYNC.DEFAULT_INDENTATION}
);

// A workspace file's folder entry: a path, absolute or from the file's folder, as VS Code writes one, or a URI.
const WorkspaceFileFoldersSchema = Schema.Array(
  Schema.Union([Schema.Struct({path: Schema.String}), Schema.Struct({uri: Schema.String})])
);

// The session the window was showing when it reloaded to open Aggregor's workspace, and when that was.
const SessionToReopenJson = Schema.fromJsonString(
  Schema.Struct({sessionId: EntityIdValueObjectSchema, writtenAt: Schema.Finite})
);

// Every workspace folder's path, the anchor folder's included.
const readWorkspaceFolderPaths = Effect.fn("WorkspaceInfraService.readWorkspaceFolderPaths")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  return yield* Effect.sync(() =>
    Array.map(
      workspaceDependencies.workspace.workspaceFolders === undefined
        ? []
        : workspaceDependencies.workspace.workspaceFolders,
      (workspaceFolder) => ProjectPathValueObjectSchema.make(workspaceFolder.uri.fsPath)
    )
  );
});

const listWorkspaceFolderProjects = Effect.fn("WorkspaceInfraService.listWorkspaceFolderProjects")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  return yield* Effect.sync(() => {
    const workspaceFolders =
      workspaceDependencies.workspace.workspaceFolders === undefined
        ? []
        : workspaceDependencies.workspace.workspaceFolders;
    const projectFolders = Array.filter(
      workspaceFolders,
      (folder) => folder.uri.fsPath !== workspaceDependencies.anchorFolderPath
    );

    return Array.map(projectFolders, (projectFolder): WorkspaceFolderProject => ({
      name: projectFolder.name,
      path: ProjectPathValueObjectSchema.make(projectFolder.uri.fsPath)
    }));
  });
});

// Only for a window without a saved workspace file. One change at a time: VS Code refuses a folder update made before
// the last one fired onDidChangeWorkspaceFolders, and every later one when it never does.
const updateWorkspaceFolders = Effect.fn("WorkspaceInfraService.updateWorkspaceFolders")(function* (
  workspaceDependencies: WorkspaceDependencies,
  workspaceFoldersSplice: WorkspaceFoldersSplice
) {
  yield* Effect.callback<undefined, WorkspaceFoldersUpdateRejectedError>((resume) => {
    const changeListener = workspaceDependencies.workspace.onDidChangeWorkspaceFolders(() => {
      changeListener.dispose();
      resume(Effect.undefined);
    });
    if (
      !workspaceDependencies.workspace.updateWorkspaceFolders(
        workspaceFoldersSplice.start,
        workspaceFoldersSplice.deleteCount,
        ...workspaceFoldersSplice.foldersToAdd
      )
    ) {
      changeListener.dispose();
      resume(Effect.fail(WorkspaceFoldersUpdateRejectedError.make()));
    }

    return Effect.sync(() => {
      changeListener.dispose();
    });
  });
}, Effect.timeout(WORKSPACE_FOLDERS_CHANGE.TIMEOUT));

// Written on every switch, which also brings back a deleted or edited copy.
const writeAnchorFolderSettings = Effect.fn("WorkspaceInfraService.writeAnchorFolderSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  const settingsDirectoryPath = workspaceDependencies.path.join(
    workspaceDependencies.anchorFolderPath,
    FOLDER_SETTINGS_FILE.FOLDER_NAME
  );
  const settingsJson = yield* Schema.encodeEffect(AnchorFolderSettingsJson)({
    [ANCHOR_FOLDER_SETTINGS.EXCLUDED_FILES_KEY]: {[ANCHOR_FOLDER_SETTINGS.EVERY_FILE_PATTERN]: true},
    [ANCHOR_FOLDER_SETTINGS.TERMINAL_CWD_KEY]: projectPath
  });
  yield* workspaceDependencies.fileSystem.makeDirectory(settingsDirectoryPath, {recursive: true});
  yield* workspaceDependencies.fileSystem.writeFileString(
    workspaceDependencies.path.join(settingsDirectoryPath, FOLDER_SETTINGS_FILE.FILE_NAME),
    settingsJson
  );
});

// A saved workspace whose folder 0 is the anchor folder: Aggregor's own, or one the user saved.
const isSavedAnchoredWorkspace = Effect.fn("WorkspaceInfraService.isSavedAnchoredWorkspace")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  return yield* Effect.sync(() => {
    const workspaceFile = workspaceDependencies.workspace.workspaceFile;
    const workspaceFolders = workspaceDependencies.workspace.workspaceFolders;
    const [firstWorkspaceFolder] = workspaceFolders === undefined ? [] : workspaceFolders;

    return (
      workspaceFile !== undefined &&
      workspaceFile.scheme === "file" &&
      firstWorkspaceFolder !== undefined &&
      firstWorkspaceFolder.uri.fsPath === workspaceDependencies.anchorFolderPath
    );
  });
});

// Kept beside the anchor folder for the reloaded window, which opens the session again.
const writeSessionToReopen = Effect.fn("WorkspaceInfraService.writeSessionToReopen")(function* (
  workspaceDependencies: WorkspaceDependencies,
  sessionToReopen: EntityIdValueObject
) {
  const writtenAt = yield* Clock.currentTimeMillis;
  const sessionToReopenText = yield* Schema.encodeEffect(SessionToReopenJson)({sessionId: sessionToReopen, writtenAt});

  yield* workspaceDependencies.fileSystem.writeFileString(
    workspaceDependencies.path.join(
      workspaceDependencies.path.dirname(workspaceDependencies.anchorFolderPath),
      SESSION_TO_REOPEN.FILE_NAME
    ),
    sessionToReopenText
  );
});

// The project's own settings file, in its .vscode folder.
const findProjectSettingsFilePath = Effect.fn("WorkspaceInfraService.findProjectSettingsFilePath")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string
) {
  return yield* Effect.sync(() =>
    workspaceDependencies.path.join(projectPath, FOLDER_SETTINGS_FILE.FOLDER_NAME, FOLDER_SETTINGS_FILE.FILE_NAME)
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
  const settingsFilePath = yield* findProjectSettingsFilePath(workspaceDependencies, projectPath);
  if (!(yield* workspaceDependencies.fileSystem.exists(settingsFilePath))) return {};
  const settingsText = yield* workspaceDependencies.fileSystem.readFileString(settingsFilePath);

  return yield* parseSettingsText(settingsText, settingsFilePath);
});

// What the workspace file holds now: the last copy, with whatever VS Code or an extension has written there since.
const readWorkspaceFileSettings = Effect.fn("WorkspaceInfraService.readWorkspaceFileSettings")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  const workspaceFileText = yield* workspaceDependencies.fileSystem.readFileString(
    workspaceDependencies.aggregorWorkspaceFilePath
  );
  const workspaceFile = yield* parseSettingsText(workspaceFileText, workspaceDependencies.aggregorWorkspaceFilePath);
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
  workspaceDependencies: WorkspaceDependencies,
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
        workspaceDependencies.path.basename(projectPath)
      ),
      PROJECT_SETTINGS_SYNC.WORKSPACE_FOLDER_VARIABLE,
      projectPath
    );
    const isRelativePath = Array.some(PROJECT_SETTINGS_SYNC.RELATIVE_PATH_PREFIXES, (relativePathPrefix) =>
      String.startsWith(relativePathPrefix)(withProjectFolder)
    );

    return isRelativePath ? workspaceDependencies.path.resolve(projectPath, withProjectFolder) : withProjectFolder;
  });
});

// VS Code and extensions write a relative path in the workspace file from the workspace file's folder; the project's
// own file has it from the project's folder.
const rebaseWorkspaceEdits = Effect.fn("WorkspaceInfraService.rebaseWorkspaceEdits")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string,
  workspaceEdits: FolderSettings
) {
  return yield* mapSettingTexts(workspaceEdits, (settingText) => {
    const isRelativePath = Array.some(PROJECT_SETTINGS_SYNC.RELATIVE_PATH_PREFIXES, (relativePathPrefix) =>
      String.startsWith(relativePathPrefix)(settingText)
    );
    if (!isRelativePath) return settingText;
    const absolutePath = workspaceDependencies.path.resolve(
      workspaceDependencies.path.dirname(workspaceDependencies.aggregorWorkspaceFilePath),
      settingText
    );
    const projectRelativePath = workspaceDependencies.path.relative(projectPath, absolutePath);

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

// The indentation of the first top-level property that starts a line. A deeper line's, such as the first folder's after
// `{"folders":[`, would double with every edit.
const findJsonIndentation = Effect.fn("WorkspaceInfraService.findJsonIndentation")(function* (jsonText: string) {
  const rootNode = parseTree(jsonText);
  const topLevelPropertyNodes = rootNode === undefined || rootNode.children === undefined ? [] : rootNode.children;
  const propertyIndentations = Array.filterMap(topLevelPropertyNodes, (propertyNode) => {
    const textBeforeProperty = String.slice(0, propertyNode.offset)(jsonText);
    const indentationMatch = String.match(PROJECT_SETTINGS_SYNC.INDENTATION_PATTERN)(textBeforeProperty);

    return Result.flatMap(
      Result.fromOption(indentationMatch, () => undefined),
      (indentationRegExpMatch) =>
        indentationRegExpMatch.groups === undefined || indentationRegExpMatch.groups.indentation === undefined
          ? Result.failVoid
          : Result.succeed(indentationRegExpMatch.groups.indentation)
    );
  });
  const [indentation = PROJECT_SETTINGS_SYNC.DEFAULT_INDENTATION] = propertyIndentations;

  return indentation;
});

// The JSON text with one top-level property set, or removed for an undefined value, indented as the file already is.
const editJsonPropertyInText = Effect.fn("WorkspaceInfraService.editJsonPropertyInText")(function* (
  jsonText: string,
  propertyKey: string,
  propertyValue: unknown
) {
  const indentation = yield* findJsonIndentation(jsonText);
  const isTabIndented = String.startsWith(PROJECT_SETTINGS_SYNC.TAB)(indentation);
  const formattingOptions = {
    insertSpaces: !isTabIndented,
    tabSize: isTabIndented ? PROJECT_SETTINGS_SYNC.TAB_SIZE : indentation.length
  };

  return yield* Effect.sync(() =>
    applyEdits(jsonText, modify(jsonText, [propertyKey], propertyValue, {formattingOptions}))
  );
});

const confirmSettingsDocumentSaved = Effect.fn("WorkspaceInfraService.confirmSettingsDocumentSaved")(function* (
  settingsDocument: TextDocument
) {
  if (settingsDocument.isDirty)
    return yield* SettingsFileUnsavedError.make({settingsFilePath: settingsDocument.uri.fsPath});

  return settingsDocument;
});

// Through VS Code's own copy of the file, which its settings writes share with every extension's, so none of them finds
// the file changed under it.
const openSettingsDocumentCopy = Effect.fn("WorkspaceInfraService.openSettingsDocumentCopy")(function* (
  workspaceDependencies: WorkspaceDependencies,
  settingsFilePath: string
) {
  return yield* Effect.tryPromise({
    catch: (cause) => SettingsFileNotOpenedError.make({cause, settingsFilePath}),
    try: () => workspaceDependencies.workspace.openTextDocument(workspaceDependencies.Uri.file(settingsFilePath))
  });
});

// Unsaved changes are another writer's edit about to be saved, or an editor's, which are left alone, as VS Code's own
// writes leave them.
const openSettingsDocument = Effect.fn("WorkspaceInfraService.openSettingsDocument")(function* (
  workspaceDependencies: WorkspaceDependencies,
  settingsFilePath: string
) {
  const settingsDocument = yield* openSettingsDocumentCopy(workspaceDependencies, settingsFilePath);

  return yield* Effect.retry(confirmSettingsDocumentSaved(settingsDocument), {
    schedule: Schedule.spaced(SETTINGS_FILE_WRITE_RETRY.INTERVAL_MS),
    times: SETTINGS_FILE_WRITE_RETRY.TIMES
  });
});

// A save that fails after the edit applied would leave the edit unsaved in VS Code's copy, where it blocks every settings
// write, VS Code's own included; saving again saves it, or finds that another writer's save already did.
const saveSettingsDocument = Effect.fn("WorkspaceInfraService.saveSettingsDocument")(function* (
  settingsDocument: TextDocument
) {
  const settingsFilePath = settingsDocument.uri.fsPath;
  const isSaved = yield* Effect.tryPromise({
    catch: () => SettingsFileNotSavedError.make({settingsFilePath}),
    try: () => settingsDocument.save()
  });
  if (!isSaved) return yield* SettingsFileNotSavedError.make({settingsFilePath});

  return settingsDocument;
});

// One edit that replaces the whole text, then a save, so the file changes once. Gives back the saved document.
const saveSettingsDocumentText = Effect.fn("WorkspaceInfraService.saveSettingsDocumentText")(function* (
  workspaceDependencies: WorkspaceDependencies,
  settingsDocument: TextDocument,
  editedSettingsText: string
) {
  const settingsEdit = new workspaceDependencies.WorkspaceEdit();
  const wholeText = new workspaceDependencies.Range(
    settingsDocument.positionAt(0),
    settingsDocument.positionAt(settingsDocument.getText().length)
  );
  settingsEdit.replace(settingsDocument.uri, wholeText, editedSettingsText);
  const isEditApplied = yield* Effect.promise(() => workspaceDependencies.workspace.applyEdit(settingsEdit));
  if (!isEditApplied) return yield* SettingsFileEditRejectedError.make({settingsFilePath: settingsDocument.uri.fsPath});

  return yield* Effect.retry(saveSettingsDocument(settingsDocument), {
    schedule: Schedule.spaced(SETTINGS_FILE_WRITE_RETRY.INTERVAL_MS),
    times: SETTINGS_FILE_WRITE_RETRY.TIMES
  });
});

// The window's workspace file is written by VS Code, by extensions and by Aggregor. Unsaved changes that outlast another
// writer's save are a write that failed to save, as VS Code's own folder change can; after it, VS Code refuses every
// settings write and this extension host never sees the folders change again. Saving them lets every writer go on.
const saveStaleWorkspaceFileChanges = Effect.fn("WorkspaceInfraService.saveStaleWorkspaceFileChanges")(function* (
  workspaceDependencies: WorkspaceDependencies,
  workspaceFilePath: string
) {
  const workspaceFileDocument = yield* openSettingsDocumentCopy(workspaceDependencies, workspaceFilePath);
  yield* Effect.logWarning(
    "Saving the workspace file's unsaved changes, which no other writer saved",
    workspaceFilePath
  );

  return yield* Effect.retry(saveSettingsDocument(workspaceFileDocument), {
    schedule: Schedule.spaced(SETTINGS_FILE_WRITE_RETRY.INTERVAL_MS),
    times: SETTINGS_FILE_WRITE_RETRY.TIMES
  });
});

const openWorkspaceFileDocument = Effect.fn("WorkspaceInfraService.openWorkspaceFileDocument")(
  function* (workspaceDependencies: WorkspaceDependencies, workspaceFilePath: string) {
    return yield* openSettingsDocument(workspaceDependencies, workspaceFilePath);
  },
  (effect, workspaceDependencies, workspaceFilePath) =>
    Effect.catchTag(effect, "SettingsFileUnsavedError", () =>
      saveStaleWorkspaceFileChanges(workspaceDependencies, workspaceFilePath)
    )
);

const editSettingsDocument = Effect.fn("WorkspaceInfraService.editSettingsDocument")(function* (
  workspaceDependencies: WorkspaceDependencies,
  settingsDocument: TextDocument,
  editSettingsText: (settingsText: string) => Effect.Effect<string>
) {
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
  const workspaceFileDocument = yield* openWorkspaceFileDocument(
    workspaceDependencies,
    workspaceDependencies.aggregorWorkspaceFilePath
  );

  yield* editSettingsDocument(workspaceDependencies, workspaceFileDocument, (workspaceFileText) =>
    editJsonPropertyInText(workspaceFileText, PROJECT_SETTINGS_SYNC.WORKSPACE_FILE_SETTINGS_KEY, workspaceSettings)
  );
});

// Each workspace edit goes into the project's own file, which the first one creates.
const writeWorkspaceEditsToProject = Effect.fn("WorkspaceInfraService.writeWorkspaceEditsToProject")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string,
  workspaceEdits: FolderSettings
) {
  if (Record.isEmptyRecord(workspaceEdits)) return;
  const settingsFilePath = yield* findProjectSettingsFilePath(workspaceDependencies, projectPath);
  const projectSettingEdits = yield* rebaseWorkspaceEdits(workspaceDependencies, projectPath, workspaceEdits);
  if (!(yield* workspaceDependencies.fileSystem.exists(settingsFilePath))) {
    yield* workspaceDependencies.fileSystem.makeDirectory(workspaceDependencies.path.dirname(settingsFilePath), {
      recursive: true
    });
    yield* workspaceDependencies.fileSystem.writeFileString(
      settingsFilePath,
      PROJECT_SETTINGS_SYNC.EMPTY_SETTINGS_TEXT
    );
  }

  const settingsDocument = yield* openSettingsDocument(workspaceDependencies, settingsFilePath);

  yield* editSettingsDocument(workspaceDependencies, settingsDocument, (settingsText) =>
    Effect.reduce(
      Record.toEntries(projectSettingEdits),
      () => settingsText,
      (editedSettingsText, [settingKey, settingValue]) =>
        editJsonPropertyInText(editedSettingsText, settingKey, settingValue)
    )
  );
});

const readCopiedProjectSettings = Effect.fn("WorkspaceInfraService.readCopiedProjectSettings")(
  function* (workspaceDependencies: WorkspaceDependencies) {
    const copiedProjectSettingsText = yield* workspaceDependencies.fileSystem.readFileString(
      workspaceDependencies.copiedProjectSettingsFilePath
    );

    return yield* Schema.decodeEffect(CopiedProjectSettingsJson)(copiedProjectSettingsText);
  },
  Effect.mapError(() => NoCopiedProjectSettingsError.make())
);

const writeCopiedProjectSettings = Effect.fn("WorkspaceInfraService.writeCopiedProjectSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string,
  copiedSettings: FolderSettings
) {
  const copiedProjectSettingsText = yield* Schema.encodeEffect(CopiedProjectSettingsJson)({
    projectPath,
    settings: copiedSettings
  });

  yield* workspaceDependencies.fileSystem.writeFileString(
    workspaceDependencies.copiedProjectSettingsFilePath,
    copiedProjectSettingsText
  );
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
  const projectSettingsMerge = isProjectCopied
    ? yield* mergeProjectSettings(workspaceSettings, projectSettings, copiedSettings)
    : {mergedSettings: projectSettings, workspaceEdits: {}};
  yield* writeWorkspaceEditsToProject(workspaceDependencies, projectPath, projectSettingsMerge.workspaceEdits);
  if (!Equal.equals(projectSettingsMerge.mergedSettings, workspaceSettings))
    yield* writeWorkspaceFileSettings(workspaceDependencies, projectSettingsMerge.mergedSettings);
  if (!isProjectCopied || !Equal.equals(projectSettingsMerge.mergedSettings, copiedSettings))
    yield* writeCopiedProjectSettings(workspaceDependencies, projectPath, projectSettingsMerge.mergedSettings);
});

const isAggregorWorkspaceOpen = Effect.fn("WorkspaceInfraService.isAggregorWorkspaceOpen")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  return yield* Effect.sync(() => {
    const workspaceFile = workspaceDependencies.workspace.workspaceFile;

    return (
      workspaceFile !== undefined &&
      workspaceFile.scheme === "file" &&
      workspaceFile.fsPath === workspaceDependencies.aggregorWorkspaceFilePath
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
  const projectSettingsFileChanges = yield* streamProjectSettingsFileChanges(workspaceDependencies);
  const configChanges = yield* streamVsCodeEvent(workspaceDependencies.workspace.onDidChangeConfiguration);
  const workspaceFolderChanges = yield* streamVsCodeEvent(workspaceDependencies.workspace.onDidChangeWorkspaceFolders);
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
    const copiedProjectSettings = yield* readCopiedProjectSettings(workspaceDependencies);

    yield* syncProjectSettings(workspaceDependencies, copiedProjectSettings.projectPath);
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
  yield* syncCopiedProjectSettings(workspaceDependencies);
  const settings = yield* prepareOpeningWorkspaceSettings(workspaceDependencies, projectPath);
  const folders = [{path: workspaceDependencies.anchorFolderPath}, {path: projectPath}];
  const workspaceFileText = yield* Schema.encodeEffect(AggregorWorkspaceJson)({folders, settings});
  yield* workspaceDependencies.fileSystem.writeFileString(
    workspaceDependencies.aggregorWorkspaceFilePath,
    workspaceFileText
  );
  yield* writeCopiedProjectSettings(workspaceDependencies, projectPath, settings);
  if (sessionToReopen !== undefined) yield* writeSessionToReopen(workspaceDependencies, sessionToReopen);

  yield* Effect.promise(() =>
    workspaceDependencies.commands.executeCommand(
      VS_CODE_COMMANDS.OPEN_FOLDER,
      workspaceDependencies.Uri.file(workspaceDependencies.aggregorWorkspaceFilePath),
      {forceReuseWindow: true}
    )
  );
});

// The open workspace's file, when the window has a saved one.
const findSavedWorkspaceFilePath = Effect.fn("WorkspaceInfraService.findSavedWorkspaceFilePath")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  const workspaceFile = workspaceDependencies.workspace.workspaceFile;
  if (workspaceFile === undefined || workspaceFile.scheme !== "file") return yield* NoSavedWorkspaceFileError.make();

  return workspaceFile.fsPath;
});

// Each folder entry of the workspace file's text as written, with the absolute path it names.
const readWorkspaceFileFolders = Effect.fn("WorkspaceInfraService.readWorkspaceFileFolders")(function* (
  workspaceDependencies: WorkspaceDependencies,
  workspaceFilePath: string,
  workspaceFileText: string
) {
  const workspaceFile = yield* parseSettingsText(workspaceFileText, workspaceFilePath);
  const writtenFolders = yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Unknown))(
    workspaceFile[WORKSPACE_FOLDERS_CHANGE.FILE_KEY]
  );
  const workspaceFileFolders = yield* Schema.decodeUnknownEffect(WorkspaceFileFoldersSchema)(writtenFolders);

  return Array.zipWith(
    writtenFolders,
    workspaceFileFolders,
    (writtenFolder, workspaceFileFolder): WorkspaceFileFolder => ({
      folderPath:
        "path" in workspaceFileFolder
          ? workspaceDependencies.path.resolve(
              workspaceDependencies.path.dirname(workspaceFilePath),
              workspaceFileFolder.path
            )
          : workspaceDependencies.Uri.parse(workspaceFileFolder.uri).fsPath,
      writtenFolder
    })
  );
});

// Saves the edited workspace file, then waits for this extension host to see its folders change: VS Code reloads them
// from the file and tells every extension host. An edit that leaves the folders as they were has nothing to wait for.
const saveWorkspaceFileFolders = Effect.fn("WorkspaceInfraService.saveWorkspaceFileFolders")(function* <EditError>(
  workspaceDependencies: WorkspaceDependencies,
  workspaceFilePath: string,
  editWorkspaceFile: (workspaceFileContents: WorkspaceFileContents) => Effect.Effect<string, EditError>
) {
  const foldersChanged = yield* Deferred.make<undefined>();
  yield* acquireScopedDisposable(() =>
    workspaceDependencies.workspace.onDidChangeWorkspaceFolders(() => {
      Deferred.doneUnsafe(foldersChanged, Effect.undefined);
    })
  );
  const workspaceFileDocument = yield* openWorkspaceFileDocument(workspaceDependencies, workspaceFilePath);
  const text = workspaceFileDocument.getText();
  const folders = yield* readWorkspaceFileFolders(workspaceDependencies, workspaceFilePath, text);
  const editedText = yield* editWorkspaceFile({folders, text});
  const editedFolders = yield* readWorkspaceFileFolders(workspaceDependencies, workspaceFilePath, editedText);
  const folderPathsBefore = Array.map(folders, (workspaceFileFolder) => workspaceFileFolder.folderPath);
  const folderPathsAfter = Array.map(editedFolders, (workspaceFileFolder) => workspaceFileFolder.folderPath);
  yield* Effect.annotateCurrentSpan({folderPathsAfter, folderPathsBefore, workspaceFilePath});
  if (editedText !== text) yield* saveSettingsDocumentText(workspaceDependencies, workspaceFileDocument, editedText);
  if (Equal.equals(folderPathsBefore, folderPathsAfter)) return;

  yield* Effect.timeout(Deferred.await(foldersChanged), WORKSPACE_FOLDERS_CHANGE.TIMEOUT);
}, Effect.scoped);

// Settings that can't be read leave the workspace file's as they are, for the sync once the project is in.
const readIncomingProjectSettings = Effect.fn("WorkspaceInfraService.readIncomingProjectSettings")(
  function* (workspaceDependencies: WorkspaceDependencies, projectPath: ProjectPathValueObject) {
    return yield* prepareWorkspaceSettings(workspaceDependencies, projectPath);
  },
  Effect.catch((readError) =>
    Effect.andThen(
      Effect.logWarning("Could not read the next project's settings", readError),
      Effect.fail(NoIncomingProjectSettingsError.make())
    )
  )
);

// The next project's settings come in with its folder in Aggregor's workspace only.
const prepareIncomingProjectSettings = Effect.fn("WorkspaceInfraService.prepareIncomingProjectSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  if (!(yield* isAggregorWorkspaceOpen(workspaceDependencies))) return yield* NoIncomingProjectSettingsError.make();

  return yield* readIncomingProjectSettings(workspaceDependencies, projectPath);
});

// Folder 0 as the file has it, when it is the anchor folder.
const findAnchorFolderEntry = Effect.fn("WorkspaceInfraService.findAnchorFolderEntry")(function* (
  workspaceDependencies: WorkspaceDependencies,
  folders: readonly WorkspaceFileFolder[]
) {
  const [firstFolder] = folders;

  return yield* Effect.succeed(
    firstFolder !== undefined && firstFolder.folderPath === workspaceDependencies.anchorFolderPath
      ? firstFolder.writtenFolder
      : {path: workspaceDependencies.anchorFolderPath}
  );
});

// The anchor folder, then the project; and the project's settings when they come in too.
const editWorkspaceFileForProject = Effect.fn("WorkspaceInfraService.editWorkspaceFileForProject")(function* (
  workspaceDependencies: WorkspaceDependencies,
  workspaceFileContents: WorkspaceFileContents,
  incomingProject: IncomingProject
) {
  const anchorFolder = yield* findAnchorFolderEntry(workspaceDependencies, workspaceFileContents.folders);
  const withProjectFolder = yield* editJsonPropertyInText(
    workspaceFileContents.text,
    WORKSPACE_FOLDERS_CHANGE.FILE_KEY,
    [anchorFolder, {path: incomingProject.projectPath}]
  );
  if (Result.isFailure(incomingProject.settings)) return withProjectFolder;

  return yield* editJsonPropertyInText(
    withProjectFolder,
    PROJECT_SETTINGS_SYNC.WORKSPACE_FILE_SETTINGS_KEY,
    incomingProject.settings.success
  );
});

// VS Code tells the extension host about a folder change only when its own folders change. When the two disagree, as
// after a change VS Code took but never confirmed, writing the folders VS Code already shows changes nothing it sees,
// and the wait times out. Taking the project out, then putting it back, makes two changes VS Code sees, and its
// confirmations bring the extension host back in step.
const swapProjectFolderThroughNoProject = Effect.fn("WorkspaceInfraService.swapProjectFolderThroughNoProject")(
  function* (
    workspaceDependencies: WorkspaceDependencies,
    workspaceFilePath: string,
    incomingProject: IncomingProject
  ) {
    yield* Effect.logWarning(
      "VS Code didn't confirm the folder change; taking the project out of the workspace and back in",
      incomingProject.projectPath
    );
    yield* saveWorkspaceFileFolders(workspaceDependencies, workspaceFilePath, (workspaceFileContents) =>
      Effect.flatMap(findAnchorFolderEntry(workspaceDependencies, workspaceFileContents.folders), (anchorFolder) =>
        editJsonPropertyInText(workspaceFileContents.text, WORKSPACE_FOLDERS_CHANGE.FILE_KEY, [anchorFolder])
      )
    );

    yield* saveWorkspaceFileFolders(workspaceDependencies, workspaceFilePath, (workspaceFileContents) =>
      editWorkspaceFileForProject(workspaceDependencies, workspaceFileContents, incomingProject)
    );
  }
);

// One write of the workspace file brings the project in: its folder and, in Aggregor's workspace, its settings, so
// Peacock applies the color it finds with the folder instead of racing a later copy. updateWorkspaceFolders isn't used:
// it waits for VS Code to confirm each change, and once a confirmation never comes it refuses every later change until
// the window reloads. The copy is recorded first, so a write that fails leaves the next sync to bring the shown
// project's settings back.
const swapProjectFolderInWorkspaceFile = Effect.fn("WorkspaceInfraService.swapProjectFolderInWorkspaceFile")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  const workspaceFilePath = yield* findSavedWorkspaceFilePath(workspaceDependencies);
  const settings = yield* Effect.result(prepareIncomingProjectSettings(workspaceDependencies, projectPath));
  if (Result.isSuccess(settings))
    yield* writeCopiedProjectSettings(workspaceDependencies, projectPath, settings.success);
  const incomingProject: IncomingProject = {projectPath, settings};

  yield* Effect.catchTag(
    saveWorkspaceFileFolders(workspaceDependencies, workspaceFilePath, (workspaceFileContents) =>
      editWorkspaceFileForProject(workspaceDependencies, workspaceFileContents, incomingProject)
    ),
    "TimeoutError",
    () => swapProjectFolderThroughNoProject(workspaceDependencies, workspaceFilePath, incomingProject)
  );
});

// The last resort when VS Code confirms no folder change at all: the reloaded window reads its folders from the file,
// which names the project by now, in a new extension host, and opens the session in view again.
const reloadWindowForProject = Effect.fn("WorkspaceInfraService.reloadWindowForProject")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject,
  sessionToReopen: EntityIdValueObject | undefined
) {
  yield* Effect.logWarning("VS Code confirmed no folder change; reloading the window to show the project", projectPath);
  yield* writeAnchorFolderSettings(workspaceDependencies, projectPath);
  if (sessionToReopen !== undefined) yield* writeSessionToReopen(workspaceDependencies, sessionToReopen);

  yield* Effect.promise(() => workspaceDependencies.commands.executeCommand(VS_CODE_COMMANDS.RELOAD_WINDOW));
});

// Makes the project folder 1 of a saved anchored workspace, or opens Aggregor's workspace with it, which reloads the
// window. The anchor folder's settings follow the project: before a reload, and after a swap, so a swap that fails
// leaves them with the project still shown.
const moveProjectFolderIn = Effect.fn("WorkspaceInfraService.moveProjectFolderIn")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject,
  sessionToReopen: EntityIdValueObject | undefined
) {
  if (!(yield* isSavedAnchoredWorkspace(workspaceDependencies))) {
    yield* writeAnchorFolderSettings(workspaceDependencies, projectPath);

    return yield* openAggregorWorkspace(workspaceDependencies, projectPath, sessionToReopen);
  }
  yield* Effect.catchTag(swapProjectFolderInWorkspaceFile(workspaceDependencies, projectPath), "TimeoutError", () =>
    reloadWindowForProject(workspaceDependencies, projectPath, sessionToReopen)
  );

  return yield* writeAnchorFolderSettings(workspaceDependencies, projectPath);
});

// Once per project and extension host: a restarted host's extensions start from folder 0 again.
const selectProjectFolderInExtensions = Effect.fn("WorkspaceInfraService.selectProjectFolderInExtensions")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  if ((yield* Ref.getAndSet(workspaceDependencies.selectedProjectPath, projectPath)) === projectPath) return;
  const installedFolderSelectCommands = Array.filter(
    FOLDER_SELECT_COMMANDS,
    (folderSelectCommand) =>
      workspaceDependencies.extensions.getExtension(folderSelectCommand.extensionId) !== undefined
  );

  yield* Effect.forEach(installedFolderSelectCommands, (folderSelectCommand) =>
    Effect.tryPromise({
      catch: (cause) => FolderSelectFailedError.make({cause}),
      try: () =>
        workspaceDependencies.commands.executeCommand(
          folderSelectCommand.command,
          workspaceDependencies.Uri.file(projectPath)
        )
    })
  );
});

// The shown project's workspace edits reach it before it leaves, and the next project's settings come in with it; the
// sync once it is in sends any edit an extension made on its arrival back to it.
const switchShownProject = Effect.fn("WorkspaceInfraService.switchShownProject")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject,
  sessionToReopen: EntityIdValueObject | undefined
) {
  yield* syncShownProjectSettings(workspaceDependencies);
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
    yield* Effect.annotateCurrentSpan({projectPath, workspaceFolderPaths});
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

// Every entry naming the project after folder 0 leaves; changing folder 0 would restart every extension, so a project
// there stays.
const removeProjectFolderFromWorkspaceFile = Effect.fn("WorkspaceInfraService.removeProjectFolderFromWorkspaceFile")(
  function* (
    workspaceDependencies: WorkspaceDependencies,
    workspaceFilePath: string,
    projectPath: ProjectPathValueObject
  ) {
    yield* saveWorkspaceFileFolders(workspaceDependencies, workspaceFilePath, (workspaceFileContents) =>
      editJsonPropertyInText(
        workspaceFileContents.text,
        WORKSPACE_FOLDERS_CHANGE.FILE_KEY,
        Array.filterMap(workspaceFileContents.folders, (workspaceFileFolder, folderIndex) =>
          folderIndex > 0 && workspaceFileFolder.folderPath === projectPath
            ? Result.failVoid
            : Result.succeed(workspaceFileFolder.writtenFolder)
        )
      )
    );
  }
);

// Without a saved workspace file, VS Code changes the folders itself.
const removeProjectFolderFromUnsavedWorkspace = Effect.fn(
  "WorkspaceInfraService.removeProjectFolderFromUnsavedWorkspace"
)(function* (workspaceDependencies: WorkspaceDependencies, projectPath: ProjectPathValueObject) {
  const workspaceFolderPaths = yield* readWorkspaceFolderPaths(workspaceDependencies);
  const projectFolderIndex = workspaceFolderPaths.indexOf(projectPath);
  // Changing folder 0 would restart every extension, so a project there stays.
  if (projectFolderIndex < 1) return;

  yield* updateWorkspaceFolders(workspaceDependencies, {deleteCount: 1, foldersToAdd: [], start: projectFolderIndex});
});

const removeProjectFolder = Effect.fn("WorkspaceInfraService.removeProjectFolder")(
  function* (workspaceDependencies: WorkspaceDependencies, projectPath: ProjectPathValueObject) {
    const workspaceFilePath = yield* Effect.result(findSavedWorkspaceFilePath(workspaceDependencies));
    if (Result.isFailure(workspaceFilePath))
      return yield* removeProjectFolderFromUnsavedWorkspace(workspaceDependencies, projectPath);

    return yield* removeProjectFolderFromWorkspaceFile(workspaceDependencies, workspaceFilePath.success, projectPath);
  },
  Effect.ignore({log: "Warn", message: "Could not take the project out of the workspace"})
);

// Read and deleted, so the session opens once; any failure means there is none.
const takeSessionToReopen = Effect.fn("WorkspaceInfraService.takeSessionToReopen")(
  function* (workspaceDependencies: WorkspaceDependencies) {
    const sessionToReopenPath = workspaceDependencies.path.join(
      workspaceDependencies.path.dirname(workspaceDependencies.anchorFolderPath),
      SESSION_TO_REOPEN.FILE_NAME
    );
    const sessionToReopenText = yield* workspaceDependencies.fileSystem.readFileString(sessionToReopenPath);
    yield* workspaceDependencies.fileSystem.remove(sessionToReopenPath);
    const sessionToReopen = yield* Schema.decodeEffect(SessionToReopenJson)(sessionToReopenText);
    const now = yield* Clock.currentTimeMillis;
    if (now - sessionToReopen.writtenAt > SESSION_TO_REOPEN.LIFETIME_MS) return yield* NoSessionToReopenError.make();

    return sessionToReopen.sessionId;
  },
  Effect.mapError(() => NoSessionToReopenError.make())
);

const watchWorkspaceFolderChanges = Effect.fn("WorkspaceInfraService.watchWorkspaceFolderChanges")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  const workspaceFolderEvents = yield* streamVsCodeEvent(workspaceDependencies.workspace.onDidChangeWorkspaceFolders);

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
