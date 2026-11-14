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

type WorkspaceDependencies = {
  readonly aggregorWorkspaceFilePath: string;
  readonly anchorFolderPath: string;
  readonly copiedProjectSettingsFilePath: string;
  readonly fileSystem: FileSystem;
  readonly path: Path;
  readonly projectSettingsLock: Semaphore.Semaphore;
  readonly selectedProjectPath: Ref.Ref<ProjectPathValueObject | undefined>;
} & Pick<VsCodeApi["Service"], "commands" | "extensions" | "Range" | "Uri" | "workspace" | "WorkspaceEdit">;

interface WorkspaceFileFolder {
  readonly folderPath: string;
  readonly writtenFolder: unknown;
}

interface WorkspaceFileContents {
  readonly folders: readonly WorkspaceFileFolder[];
  readonly text: string;
}

interface WorkspaceFoldersSplice {
  readonly deleteCount: number;
  readonly foldersToAdd: readonly WorkspaceFolderToAdd[];
  readonly start: number;
}

interface WorkspaceFolderToAdd {
  readonly uri: Uri;
}

class FolderSelectFailedError extends Schema.TaggedError<FolderSelectFailedError, {readonly brand: unique symbol}>()(
  "FolderSelectFailedError",
  {cause: Schema.Unknown}
) {}
class NoCopiedProjectSettingsError extends Schema.TaggedError<
  NoCopiedProjectSettingsError,
  {readonly brand: unique symbol}
>()("NoCopiedProjectSettingsError", {}) {}
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
class SettingsFileNotOpenedError extends Schema.TaggedError<
  SettingsFileNotOpenedError,
  {readonly brand: unique symbol}
>()("SettingsFileNotOpenedError", {cause: Schema.Unknown, settingsFilePath: Schema.String}) {}
// VS Code didn't save the file even when asked again; the edit stays unsaved in its copy.
class SettingsFileNotSavedError extends Schema.TaggedError<
  SettingsFileNotSavedError,
  {readonly brand: unique symbol}
>()("SettingsFileNotSavedError", {settingsFilePath: Schema.String}) {}
// The settings file isn't JSON with comments, as while it is being edited.
class SettingsFileUnreadableError extends Schema.TaggedError<
  SettingsFileUnreadableError,
  {readonly brand: unique symbol}
>()("SettingsFileUnreadableError", {settingsFilePath: Schema.String}) {}
// Unsaved changes outlasted another writer's time to save, as an editor's would; the sync after their save writes it.
class SettingsFileUnsavedError extends Schema.TaggedError<SettingsFileUnsavedError, {readonly brand: unique symbol}>()(
  "SettingsFileUnsavedError",
  {settingsFilePath: Schema.String}
) {}
class WorkspaceFoldersUpdateRejectedError extends Schema.TaggedError<
  WorkspaceFoldersUpdateRejectedError,
  {readonly brand: unique symbol}
>()("WorkspaceFoldersUpdateRejectedError", {}) {}

const FolderSettingsSchema = Schema.Record(Schema.String, Schema.Unknown);
type FolderSettings = typeof FolderSettingsSchema.Type;
const isFolderSettings = Schema.is(FolderSettingsSchema);

interface IncomingProject {
  readonly projectPath: ProjectPathValueObject;
  readonly settings: Result.Result<FolderSettings, NoIncomingProjectSettingsError>;
}

// Each side is compared with the last copy, to tell an edit on one side from one on the other.
const CopiedProjectSettingsJson = Schema.fromJsonString(
  Schema.Struct({projectPath: Schema.String, settings: FolderSettingsSchema})
);

const AnchorFolderSettingsJson = Schema.fromJsonString(
  Schema.Struct({
    [ANCHOR_FOLDER_SETTINGS.EXCLUDED_FILES_KEY]: Schema.Record(Schema.String, Schema.Boolean),
    [ANCHOR_FOLDER_SETTINGS.TERMINAL_CWD_KEY]: Schema.String
  })
);

// VS Code names the window after the file, Aggregor, and never asks to save it.
const AggregorWorkspaceJson = Schema.fromJsonString(
  Schema.Struct({folders: Schema.Array(Schema.Struct({path: Schema.String})), settings: FolderSettingsSchema}),
  {space: PROJECT_SETTINGS_SYNC.DEFAULT_INDENTATION}
);

const WorkspaceFileFoldersSchema = Schema.Array(
  Schema.Union([Schema.Struct({path: Schema.String}), Schema.Struct({uri: Schema.String})])
);

const SessionToReopenJson = Schema.fromJsonString(
  Schema.Struct({sessionId: EntityIdValueObjectSchema, writtenAt: Schema.Finite})
);

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

// One change at a time: VS Code refuses a folder update made before the last one fired onDidChangeWorkspaceFolders.
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

const findProjectSettingsFilePath = Effect.fn("WorkspaceInfraService.findProjectSettingsFilePath")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: string
) {
  return yield* Effect.sync(() =>
    workspaceDependencies.path.join(projectPath, FOLDER_SETTINGS_FILE.FOLDER_NAME, FOLDER_SETTINGS_FILE.FILE_NAME)
  );
});

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

// In the workspace file, a relative path or a folder variable would name the anchor folder.
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

// A relative path in the workspace file starts from that file's folder; the project's own file has it from its own.
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

// The project's edit wins; one made only in the workspace file goes to the project's file, and undefined removes it.
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

// A deeper line's indentation, such as the first folder's after `{"folders":[`, would double with every edit.
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

// VS Code's own copy of the file is shared with every extension's settings writes, so none finds it changed under it.
const openSettingsDocumentCopy = Effect.fn("WorkspaceInfraService.openSettingsDocumentCopy")(function* (
  workspaceDependencies: WorkspaceDependencies,
  settingsFilePath: string
) {
  return yield* Effect.tryPromise({
    catch: (cause) => SettingsFileNotOpenedError.make({cause, settingsFilePath}),
    try: () => workspaceDependencies.workspace.openTextDocument(workspaceDependencies.Uri.file(settingsFilePath))
  });
});

// Unsaved changes are another writer's or an editor's, and are left alone, as VS Code's own writes leave them.
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

// An edit left unsaved in VS Code's copy blocks every settings write, VS Code's own included, so the save is retried.
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

// One edit that replaces the whole text, then a save, so the file changes once.
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

// A write that failed to save makes VS Code refuse every settings write and hide folder changes, so it is saved.
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

// Edits go to the project first, so a failure there leaves them in the workspace file for the next sync.
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

// A failure leaves both sides, edits included, for the next sync.
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

// An extension such as Peacock writes its settings in the workspace file, so any settings write starts a sync.
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

// Opening the file reloads this window; VS Code shows another window instead when that one already has it open.
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

const findSavedWorkspaceFilePath = Effect.fn("WorkspaceInfraService.findSavedWorkspaceFilePath")(function* (
  workspaceDependencies: WorkspaceDependencies
) {
  const workspaceFile = workspaceDependencies.workspace.workspaceFile;
  if (workspaceFile === undefined || workspaceFile.scheme !== "file") return yield* NoSavedWorkspaceFileError.make();

  return workspaceFile.fsPath;
});

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

// VS Code reloads the folders from the saved file and tells every extension host, which this waits for.
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

const prepareIncomingProjectSettings = Effect.fn("WorkspaceInfraService.prepareIncomingProjectSettings")(function* (
  workspaceDependencies: WorkspaceDependencies,
  projectPath: ProjectPathValueObject
) {
  if (!(yield* isAggregorWorkspaceOpen(workspaceDependencies))) return yield* NoIncomingProjectSettingsError.make();

  return yield* readIncomingProjectSettings(workspaceDependencies, projectPath);
});

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

// VS Code confirms only folder changes it sees, so the project is taken out and put back to bring the host in step.
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

// One write brings in the folder with its settings, so Peacock doesn't race a later copy; updateWorkspaceFolders wedges.
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

// The last resort when VS Code confirms no folder change at all: the reloaded window reads its folders from the file.
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

// The anchor folder's settings follow the project after a swap, so a swap that fails leaves them with the project shown.
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

// The shown project's workspace edits reach it before it leaves.
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

// Changing folder 0 would restart every extension, so a project there stays.
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
