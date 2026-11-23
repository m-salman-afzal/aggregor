import {NodeServices} from "@effect/platform-node";
import {AnchorFolderUtils} from "@infraUtils/anchorFolder.utils.ts";
import {IWorkspaceInfraService, IWorkspaceInfraServiceErrors} from "@interfaces/workspace.infraService.interface.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";
import {
  AGGREGOR_WORKSPACE,
  AGGREGOR_WORKSPACE_SETTINGS,
  ANCHOR_FOLDER_SETTINGS,
  FOLDER_SELECT_COMMANDS,
  FOLDER_SETTINGS_FILE,
  PROJECT_SETTINGS_SYNC,
  SESSION_TO_REOPEN,
  SETTINGS_FILE_WRITE_RETRY,
  WORKSPACE_FOLDERS_CHANGE
} from "@pkg/constants/src/workspace.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {
  Array,
  Clock,
  Context,
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

class WorkspaceInfraServiceErrors extends TaggedErrors({
  FolderSelectFailedError: {cause: Schema.Unknown},
  NoCopiedProjectSettingsError: {},
  NoIncomingProjectSettingsError: {},
  NoSavedWorkspaceFileError: {},
  SettingsFileEditRejectedError: {settingsFilePath: Schema.String},
  SettingsFileNotOpenedError: {cause: Schema.Unknown, settingsFilePath: Schema.String},
  SettingsFileNotSavedError: {settingsFilePath: Schema.String},
  SettingsFileUnreadableError: {settingsFilePath: Schema.String},
  SettingsFileUnsavedError: {settingsFilePath: Schema.String},
  WorkspaceFoldersUpdateRejectedError: {}
}) {}

const FolderSettingsSchema = Schema.Record(Schema.String, Schema.Unknown);
type FolderSettings = typeof FolderSettingsSchema.Type;
const isFolderSettings = Schema.is(FolderSettingsSchema);

interface IncomingProject {
  readonly projectPath: ProjectPathValueObject;
  readonly settings: Result.Result<FolderSettings, WorkspaceInfraServiceErrors["NoIncomingProjectSettingsError"]>;
}

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

export class WorkspaceInfraService extends Context.Service<WorkspaceInfraService>()(
  "aggregor-app/infrastructure/services/vscode/workspace.infraService/WorkspaceInfraService",
  {
    make: Effect.fn("WorkspaceInfraService.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const anchorFolderUtils = yield* AnchorFolderUtils;
      const anchorFolderPath = yield* anchorFolderUtils.getAnchorFolderPath;
      const aggregorWorkspaceFilePath = path.join(
        path.dirname(anchorFolderPath),
        AGGREGOR_WORKSPACE.WORKSPACE_FILE_NAME
      );
      const copiedProjectSettingsFilePath = path.join(
        path.dirname(anchorFolderPath),
        PROJECT_SETTINGS_SYNC.COPIED_SETTINGS_FILE_NAME
      );
      const projectSettingsLock = yield* Semaphore.make(1);
      const selectedProjectPath = yield* Ref.make<ProjectPathValueObject | undefined>(undefined);

      const readWorkspaceFolderPaths = Effect.fn("WorkspaceInfraService.readWorkspaceFolderPaths")(function* () {
        return yield* Effect.sync(() =>
          Array.map(
            vsCodeApi.workspace.workspaceFolders === undefined ? [] : vsCodeApi.workspace.workspaceFolders,
            (workspaceFolder) => ProjectPathValueObjectSchema.make(workspaceFolder.uri.fsPath)
          )
        );
      });

      const listWorkspaceFolderProjects = Effect.fn("WorkspaceInfraService.listWorkspaceFolderProjects")(function* () {
        return yield* Effect.sync(() => {
          const workspaceFolders =
            vsCodeApi.workspace.workspaceFolders === undefined ? [] : vsCodeApi.workspace.workspaceFolders;
          const projectFolders = Array.filter(workspaceFolders, (folder) => folder.uri.fsPath !== anchorFolderPath);

          return Array.map(projectFolders, (projectFolder): WorkspaceFolderProject => ({
            name: projectFolder.name,
            path: ProjectPathValueObjectSchema.make(projectFolder.uri.fsPath)
          }));
        });
      });

      // One change at a time: VS Code refuses a folder update made before the last one fired onDidChangeWorkspaceFolders.
      const updateWorkspaceFolders = Effect.fn("WorkspaceInfraService.updateWorkspaceFolders")(function* (
        workspaceFoldersSplice: WorkspaceFoldersSplice
      ) {
        yield* Effect.callback<undefined, WorkspaceInfraServiceErrors["WorkspaceFoldersUpdateRejectedError"]>(
          (resume) => {
            const changeListener = vsCodeApi.workspace.onDidChangeWorkspaceFolders(() => {
              changeListener.dispose();
              resume(Effect.undefined);
            });
            if (
              !vsCodeApi.workspace.updateWorkspaceFolders(
                workspaceFoldersSplice.start,
                workspaceFoldersSplice.deleteCount,
                ...workspaceFoldersSplice.foldersToAdd
              )
            ) {
              changeListener.dispose();
              resume(Effect.fail(WorkspaceInfraServiceErrors.WorkspaceFoldersUpdateRejectedError.make()));
            }

            return Effect.sync(() => {
              changeListener.dispose();
            });
          }
        );
      }, Effect.timeout(WORKSPACE_FOLDERS_CHANGE.TIMEOUT));

      const writeAnchorFolderSettings = Effect.fn("WorkspaceInfraService.writeAnchorFolderSettings")(function* (
        projectPath: ProjectPathValueObject
      ) {
        const settingsDirectoryPath = path.join(anchorFolderPath, FOLDER_SETTINGS_FILE.FOLDER_NAME);
        const settingsJson = yield* Schema.encodeEffect(AnchorFolderSettingsJson)({
          [ANCHOR_FOLDER_SETTINGS.EXCLUDED_FILES_KEY]: {[ANCHOR_FOLDER_SETTINGS.EVERY_FILE_PATTERN]: true},
          [ANCHOR_FOLDER_SETTINGS.TERMINAL_CWD_KEY]: projectPath
        });
        yield* fileSystem.makeDirectory(settingsDirectoryPath, {recursive: true});
        yield* fileSystem.writeFileString(
          path.join(settingsDirectoryPath, FOLDER_SETTINGS_FILE.FILE_NAME),
          settingsJson
        );
      });

      const isSavedAnchoredWorkspace = Effect.fn("WorkspaceInfraService.isSavedAnchoredWorkspace")(function* () {
        return yield* Effect.sync(() => {
          const workspaceFile = vsCodeApi.workspace.workspaceFile;
          const workspaceFolders = vsCodeApi.workspace.workspaceFolders;
          const [firstWorkspaceFolder] = workspaceFolders === undefined ? [] : workspaceFolders;

          return (
            workspaceFile !== undefined &&
            workspaceFile.scheme === "file" &&
            firstWorkspaceFolder !== undefined &&
            firstWorkspaceFolder.uri.fsPath === anchorFolderPath
          );
        });
      });

      const writeSessionToReopen = Effect.fn("WorkspaceInfraService.writeSessionToReopen")(function* (
        sessionToReopen: EntityIdValueObject
      ) {
        const writtenAt = yield* Clock.currentTimeMillis;
        const sessionToReopenText = yield* Schema.encodeEffect(SessionToReopenJson)({
          sessionId: sessionToReopen,
          writtenAt
        });

        yield* fileSystem.writeFileString(
          path.join(path.dirname(anchorFolderPath), SESSION_TO_REOPEN.FILE_NAME),
          sessionToReopenText
        );
      });

      const findProjectSettingsFilePath = Effect.fn("WorkspaceInfraService.findProjectSettingsFilePath")(function* (
        projectPath: string
      ) {
        return yield* Effect.sync(() =>
          path.join(projectPath, FOLDER_SETTINGS_FILE.FOLDER_NAME, FOLDER_SETTINGS_FILE.FILE_NAME)
        );
      });

      const parseSettingsText = Effect.fn("WorkspaceInfraService.parseSettingsText")(function* (
        settingsText: string,
        settingsFilePath: string
      ) {
        const parseErrors: ParseError[] = [];
        const parsedSettings: unknown = parse(settingsText, parseErrors, {allowTrailingComma: true});
        if (parseErrors.length > 0)
          return yield* WorkspaceInfraServiceErrors.SettingsFileUnreadableError.make({settingsFilePath});

        return yield* Schema.decodeUnknownEffect(FolderSettingsSchema)(parsedSettings);
      });

      const readProjectSettings = Effect.fn("WorkspaceInfraService.readProjectSettings")(function* (
        projectPath: string
      ) {
        const settingsFilePath = yield* findProjectSettingsFilePath(projectPath);
        if (!(yield* fileSystem.exists(settingsFilePath))) return {};
        const settingsText = yield* fileSystem.readFileString(settingsFilePath);

        return yield* parseSettingsText(settingsText, settingsFilePath);
      });

      const readWorkspaceFileSettings = Effect.fn("WorkspaceInfraService.readWorkspaceFileSettings")(function* () {
        const workspaceFileText = yield* fileSystem.readFileString(aggregorWorkspaceFilePath);
        const workspaceFile = yield* parseSettingsText(workspaceFileText, aggregorWorkspaceFilePath);
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
        projectPath: string,
        projectSettings: FolderSettings
      ) {
        // Split and joined rather than replaced, so a `$` in the project's path is kept as it is.
        const replaceVariable = (settingText: string, variable: string, variableValue: string) =>
          Array.join(String.split(settingText, variable), variableValue);

        return yield* mapSettingTexts(projectSettings, (settingText) => {
          const settingTextWithProjectFolder = replaceVariable(
            replaceVariable(
              settingText,
              PROJECT_SETTINGS_SYNC.WORKSPACE_FOLDER_BASENAME_VARIABLE,
              path.basename(projectPath)
            ),
            PROJECT_SETTINGS_SYNC.WORKSPACE_FOLDER_VARIABLE,
            projectPath
          );
          const isRelativePath = Array.some(PROJECT_SETTINGS_SYNC.RELATIVE_PATH_PREFIXES, (relativePathPrefix) =>
            String.startsWith(relativePathPrefix)(settingTextWithProjectFolder)
          );

          return isRelativePath
            ? path.resolve(projectPath, settingTextWithProjectFolder)
            : settingTextWithProjectFolder;
        });
      });

      // A relative path in the workspace file starts from that file's folder; the project's own file has it from its own.
      const rebaseWorkspaceEdits = Effect.fn("WorkspaceInfraService.rebaseWorkspaceEdits")(function* (
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

      // Aggregor's own settings count as the project's, so the sync never takes them for an edit to write to the project.
      const prepareWorkspaceSettings = Effect.fn("WorkspaceInfraService.prepareWorkspaceSettings")(function* (
        projectPath: string
      ) {
        const projectSettings = yield* readProjectSettings(projectPath);
        const resolvedProjectSettings = yield* resolveProjectSettings(projectPath, projectSettings);
        const workspaceSettings: FolderSettings = {...resolvedProjectSettings, ...AGGREGOR_WORKSPACE_SETTINGS};

        return workspaceSettings;
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
        const topLevelPropertyNodes =
          rootNode === undefined || rootNode.children === undefined ? [] : rootNode.children;
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
          return yield* WorkspaceInfraServiceErrors.SettingsFileUnsavedError.make({
            settingsFilePath: settingsDocument.uri.fsPath
          });

        return settingsDocument;
      });

      // VS Code's own copy of the file is shared with every extension's settings writes, so none finds it changed under it.
      const openSettingsDocumentCopy = Effect.fn("WorkspaceInfraService.openSettingsDocumentCopy")(function* (
        settingsFilePath: string
      ) {
        return yield* Effect.tryPromise({
          catch: (cause) => WorkspaceInfraServiceErrors.SettingsFileNotOpenedError.make({cause, settingsFilePath}),
          try: () => vsCodeApi.workspace.openTextDocument(vsCodeApi.Uri.file(settingsFilePath))
        });
      });

      // Unsaved changes are another writer's or an editor's, and are left alone, as VS Code's own writes leave them.
      const openSettingsDocument = Effect.fn("WorkspaceInfraService.openSettingsDocument")(function* (
        settingsFilePath: string
      ) {
        const settingsDocument = yield* openSettingsDocumentCopy(settingsFilePath);

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
          catch: () => WorkspaceInfraServiceErrors.SettingsFileNotSavedError.make({settingsFilePath}),
          try: () => settingsDocument.save()
        });
        if (!isSaved) return yield* WorkspaceInfraServiceErrors.SettingsFileNotSavedError.make({settingsFilePath});

        return settingsDocument;
      });

      const saveSettingsDocumentText = Effect.fn("WorkspaceInfraService.saveSettingsDocumentText")(function* (
        settingsDocument: TextDocument,
        editedSettingsText: string
      ) {
        const settingsEdit = new vsCodeApi.WorkspaceEdit();
        const wholeText = new vsCodeApi.Range(
          settingsDocument.positionAt(0),
          settingsDocument.positionAt(settingsDocument.getText().length)
        );
        settingsEdit.replace(settingsDocument.uri, wholeText, editedSettingsText);
        const isEditApplied = yield* Effect.promise(() => vsCodeApi.workspace.applyEdit(settingsEdit));
        if (!isEditApplied)
          return yield* WorkspaceInfraServiceErrors.SettingsFileEditRejectedError.make({
            settingsFilePath: settingsDocument.uri.fsPath
          });

        return yield* Effect.retry(saveSettingsDocument(settingsDocument), {
          schedule: Schedule.spaced(SETTINGS_FILE_WRITE_RETRY.INTERVAL_MS),
          times: SETTINGS_FILE_WRITE_RETRY.TIMES
        });
      });

      // A write that failed to save makes VS Code refuse every settings write and hide folder changes, so it is saved.
      const saveStaleWorkspaceFileChanges = Effect.fn("WorkspaceInfraService.saveStaleWorkspaceFileChanges")(function* (
        workspaceFilePath: string
      ) {
        const workspaceFileDocument = yield* openSettingsDocumentCopy(workspaceFilePath);
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
        function* (workspaceFilePath: string) {
          return yield* openSettingsDocument(workspaceFilePath);
        },
        (effect, workspaceFilePath) =>
          Effect.catchTag(effect, "SettingsFileUnsavedError", () => saveStaleWorkspaceFileChanges(workspaceFilePath))
      );

      const editSettingsDocument = Effect.fn("WorkspaceInfraService.editSettingsDocument")(function* (
        settingsDocument: TextDocument,
        editSettingsText: (settingsText: string) => Effect.Effect<string>
      ) {
        const settingsText = settingsDocument.getText();
        const editedSettingsText = yield* editSettingsText(settingsText);
        if (editedSettingsText !== settingsText) yield* saveSettingsDocumentText(settingsDocument, editedSettingsText);
      });

      const writeWorkspaceFileSettings = Effect.fn("WorkspaceInfraService.writeWorkspaceFileSettings")(function* (
        workspaceSettings: FolderSettings
      ) {
        const workspaceFileDocument = yield* openWorkspaceFileDocument(aggregorWorkspaceFilePath);

        yield* editSettingsDocument(workspaceFileDocument, (workspaceFileText) =>
          editJsonPropertyInText(
            workspaceFileText,
            PROJECT_SETTINGS_SYNC.WORKSPACE_FILE_SETTINGS_KEY,
            workspaceSettings
          )
        );
      });

      const writeWorkspaceEditsToProject = Effect.fn("WorkspaceInfraService.writeWorkspaceEditsToProject")(function* (
        projectPath: string,
        workspaceEdits: FolderSettings
      ) {
        if (Record.isEmptyRecord(workspaceEdits)) return;
        const settingsFilePath = yield* findProjectSettingsFilePath(projectPath);
        const projectSettingEdits = yield* rebaseWorkspaceEdits(projectPath, workspaceEdits);
        if (!(yield* fileSystem.exists(settingsFilePath))) {
          yield* fileSystem.makeDirectory(path.dirname(settingsFilePath), {
            recursive: true
          });
          yield* fileSystem.writeFileString(settingsFilePath, PROJECT_SETTINGS_SYNC.EMPTY_SETTINGS_TEXT);
        }

        const settingsDocument = yield* openSettingsDocument(settingsFilePath);

        yield* editSettingsDocument(settingsDocument, (settingsText) =>
          Effect.reduce(
            Record.toEntries(projectSettingEdits),
            () => settingsText,
            (editedSettingsText, [settingKey, settingValue]) =>
              editJsonPropertyInText(editedSettingsText, settingKey, settingValue)
          )
        );
      });

      const readCopiedProjectSettings = Effect.fn("WorkspaceInfraService.readCopiedProjectSettings")(
        function* () {
          const copiedProjectSettingsText = yield* fileSystem.readFileString(copiedProjectSettingsFilePath);

          return yield* Schema.decodeEffect(CopiedProjectSettingsJson)(copiedProjectSettingsText);
        },
        Effect.mapError(() => WorkspaceInfraServiceErrors.NoCopiedProjectSettingsError.make())
      );

      const writeCopiedProjectSettings = Effect.fn("WorkspaceInfraService.writeCopiedProjectSettings")(function* (
        projectPath: string,
        copiedSettings: FolderSettings
      ) {
        const copiedProjectSettingsText = yield* Schema.encodeEffect(CopiedProjectSettingsJson)({
          projectPath,
          settings: copiedSettings
        });

        yield* fileSystem.writeFileString(copiedProjectSettingsFilePath, copiedProjectSettingsText);
      });

      // Edits go to the project first, so a failure there leaves them in the workspace file for the next sync.
      const syncProjectSettings = Effect.fn("WorkspaceInfraService.syncProjectSettings")(function* (
        projectPath: string
      ) {
        const isProjectFolderThere = yield* fileSystem.exists(projectPath);
        yield* Effect.annotateCurrentSpan({isProjectFolderThere});
        // A deleted worktree is still the shown project when the switch away syncs it, and a write would bring it back.
        if (!isProjectFolderThere) return;
        const projectSettings = yield* prepareWorkspaceSettings(projectPath);
        const workspaceSettings = yield* readWorkspaceFileSettings();
        const copiedProjectSettings = yield* Effect.result(readCopiedProjectSettings());
        const isProjectCopied =
          Result.isSuccess(copiedProjectSettings) && copiedProjectSettings.success.projectPath === projectPath;
        const copiedSettings = isProjectCopied ? copiedProjectSettings.success.settings : projectSettings;
        const projectSettingsMerge = isProjectCopied
          ? yield* mergeProjectSettings(workspaceSettings, projectSettings, copiedSettings)
          : {mergedSettings: projectSettings, workspaceEdits: {}};
        yield* writeWorkspaceEditsToProject(projectPath, projectSettingsMerge.workspaceEdits);
        if (!Equal.equals(projectSettingsMerge.mergedSettings, workspaceSettings))
          yield* writeWorkspaceFileSettings(projectSettingsMerge.mergedSettings);
        if (!isProjectCopied || !Equal.equals(projectSettingsMerge.mergedSettings, copiedSettings))
          yield* writeCopiedProjectSettings(projectPath, projectSettingsMerge.mergedSettings);
      });

      const isAggregorWorkspaceOpen = Effect.fn("WorkspaceInfraService.isAggregorWorkspaceOpen")(function* () {
        return yield* Effect.sync(() => {
          const workspaceFile = vsCodeApi.workspace.workspaceFile;

          return (
            workspaceFile !== undefined &&
            workspaceFile.scheme === "file" &&
            workspaceFile.fsPath === aggregorWorkspaceFilePath
          );
        });
      });

      const syncShownProjectSettings = Effect.fn("WorkspaceInfraService.syncShownProjectSettings")(
        function* () {
          if (!(yield* isAggregorWorkspaceOpen())) return;
          const workspaceFolderProjects = yield* listWorkspaceFolderProjects();
          const [shownProject] = workspaceFolderProjects;
          if (workspaceFolderProjects.length !== 1 || shownProject === undefined) return;

          yield* syncProjectSettings(shownProject.path);
        },
        Effect.ignore({log: "Warn", message: "Could not sync the project's settings with Aggregor's workspace"})
      );

      const syncShownProjectSettingsInTurn = Effect.fn("WorkspaceInfraService.syncShownProjectSettingsInTurn")(
        function* () {
          yield* Semaphore.withPermits(projectSettingsLock, 1)(syncShownProjectSettings());
        }
      );

      const isProjectSettingsFile = Effect.fn("WorkspaceInfraService.isProjectSettingsFile")(function* (
        changedFileUri: Uri
      ) {
        const workspaceFolderProjects = yield* listWorkspaceFolderProjects();
        const projectSettingsFilePaths = yield* Effect.forEach(workspaceFolderProjects, (workspaceFolderProject) =>
          findProjectSettingsFilePath(workspaceFolderProject.path)
        );

        return Array.contains(projectSettingsFilePaths, changedFileUri.fsPath);
      });

      const streamProjectSettingsFileChanges = Effect.fn("WorkspaceInfraService.streamProjectSettingsFileChanges")(
        function* () {
          const settingsFileWatcher = yield* vscodeUtils.acquireScopedDisposable(() =>
            vsCodeApi.workspace.createFileSystemWatcher(FOLDER_SETTINGS_FILE.WATCH_PATTERN)
          );
          const settingsFileChanges = Stream.mergeAll(
            [
              yield* vscodeUtils.streamVsCodeEvent(settingsFileWatcher.onDidCreate),
              yield* vscodeUtils.streamVsCodeEvent(settingsFileWatcher.onDidChange),
              yield* vscodeUtils.streamVsCodeEvent(settingsFileWatcher.onDidDelete)
            ],
            {concurrency: "unbounded"}
          );

          return Stream.filterEffect(settingsFileChanges, (changedFileUri) => isProjectSettingsFile(changedFileUri));
        }
      );

      // An extension such as Peacock writes its settings in the workspace file, so any settings write starts a sync.
      const watchProjectSettingsChanges = Effect.fn("WorkspaceInfraService.watchProjectSettingsChanges")(function* () {
        const projectSettingsFileChanges = yield* streamProjectSettingsFileChanges();
        const configChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.workspace.onDidChangeConfiguration);
        const workspaceFolderChanges = yield* vscodeUtils.streamVsCodeEvent(
          vsCodeApi.workspace.onDidChangeWorkspaceFolders
        );
        const syncTriggers = Stream.mergeAll(
          [
            Stream.as(projectSettingsFileChanges, undefined),
            Stream.as(configChanges, undefined),
            Stream.as(workspaceFolderChanges, undefined)
          ],
          {concurrency: "unbounded"}
        );

        yield* syncShownProjectSettingsInTurn();
        yield* Stream.runForEach(syncTriggers, () => syncShownProjectSettingsInTurn());
      });

      // Edits an earlier window left in the workspace file reach their project before the file is written anew.
      const syncCopiedProjectSettings = Effect.fn("WorkspaceInfraService.syncCopiedProjectSettings")(
        function* () {
          const copiedProjectSettings = yield* readCopiedProjectSettings();

          yield* syncProjectSettings(copiedProjectSettings.projectPath);
        },
        Effect.catchTag("NoCopiedProjectSettingsError", () => Effect.void),
        Effect.ignore({
          log: "Warn",
          message: "Could not sync the last project's settings before opening Aggregor's workspace"
        })
      );

      const prepareOpeningWorkspaceSettings = Effect.fn("WorkspaceInfraService.prepareOpeningWorkspaceSettings")(
        function* (projectPath: ProjectPathValueObject) {
          return yield* prepareWorkspaceSettings(projectPath);
        },
        Effect.catch((settingsError) =>
          Effect.as(Effect.logWarning("Could not read the project's settings", settingsError), {})
        )
      );

      // Opening the file reloads this window; VS Code shows another window instead when that one already has it open.
      const openAggregorWorkspace = Effect.fn("WorkspaceInfraService.openAggregorWorkspace")(function* (
        projectPath: ProjectPathValueObject,
        sessionToReopen: EntityIdValueObject | undefined
      ) {
        yield* syncCopiedProjectSettings();
        const settings = yield* prepareOpeningWorkspaceSettings(projectPath);
        const folders = [{path: anchorFolderPath}, {path: projectPath}];
        const workspaceFileText = yield* Schema.encodeEffect(AggregorWorkspaceJson)({folders, settings});
        yield* fileSystem.writeFileString(aggregorWorkspaceFilePath, workspaceFileText);
        yield* writeCopiedProjectSettings(projectPath, settings);
        if (sessionToReopen !== undefined) yield* writeSessionToReopen(sessionToReopen);

        yield* Effect.promise(() =>
          vsCodeApi.commands.executeCommand(
            VS_CODE_COMMANDS.OPEN_FOLDER,
            vsCodeApi.Uri.file(aggregorWorkspaceFilePath),
            {
              forceReuseWindow: true
            }
          )
        );
      });

      const findSavedWorkspaceFilePath = Effect.fn("WorkspaceInfraService.findSavedWorkspaceFilePath")(function* () {
        const workspaceFile = vsCodeApi.workspace.workspaceFile;
        if (workspaceFile === undefined || workspaceFile.scheme !== "file")
          return yield* WorkspaceInfraServiceErrors.NoSavedWorkspaceFileError.make();

        return workspaceFile.fsPath;
      });

      const readWorkspaceFileFolders = Effect.fn("WorkspaceInfraService.readWorkspaceFileFolders")(function* (
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
                ? path.resolve(path.dirname(workspaceFilePath), workspaceFileFolder.path)
                : vsCodeApi.Uri.parse(workspaceFileFolder.uri).fsPath,
            writtenFolder
          })
        );
      });

      // VS Code reloads the folders from the saved file and tells every extension host, which this waits for.
      const saveWorkspaceFileFolders = Effect.fn("WorkspaceInfraService.saveWorkspaceFileFolders")(function* <
        EditError
      >(
        workspaceFilePath: string,
        editWorkspaceFile: (workspaceFileContents: WorkspaceFileContents) => Effect.Effect<string, EditError>
      ) {
        const foldersChanged = yield* Deferred.make<undefined>();
        yield* vscodeUtils.acquireScopedDisposable(() =>
          vsCodeApi.workspace.onDidChangeWorkspaceFolders(() => {
            Deferred.doneUnsafe(foldersChanged, Effect.undefined);
          })
        );
        const workspaceFileDocument = yield* openWorkspaceFileDocument(workspaceFilePath);
        const text = workspaceFileDocument.getText();
        const folders = yield* readWorkspaceFileFolders(workspaceFilePath, text);
        const editedText = yield* editWorkspaceFile({folders, text});
        const editedFolders = yield* readWorkspaceFileFolders(workspaceFilePath, editedText);
        const folderPathsBefore = Array.map(folders, (workspaceFileFolder) => workspaceFileFolder.folderPath);
        const folderPathsAfter = Array.map(editedFolders, (workspaceFileFolder) => workspaceFileFolder.folderPath);
        yield* Effect.annotateCurrentSpan({folderPathsAfter, folderPathsBefore, workspaceFilePath});
        if (editedText !== text) yield* saveSettingsDocumentText(workspaceFileDocument, editedText);
        if (Equal.equals(folderPathsBefore, folderPathsAfter)) return;

        yield* Effect.timeout(Deferred.await(foldersChanged), WORKSPACE_FOLDERS_CHANGE.TIMEOUT);
      }, Effect.scoped);

      const readIncomingProjectSettings = Effect.fn("WorkspaceInfraService.readIncomingProjectSettings")(
        function* (projectPath: ProjectPathValueObject) {
          return yield* prepareWorkspaceSettings(projectPath);
        },
        Effect.catch((readError) =>
          Effect.andThen(
            Effect.logWarning("Could not read the next project's settings", readError),
            Effect.fail(WorkspaceInfraServiceErrors.NoIncomingProjectSettingsError.make())
          )
        )
      );

      const prepareIncomingProjectSettings = Effect.fn("WorkspaceInfraService.prepareIncomingProjectSettings")(
        function* (projectPath: ProjectPathValueObject) {
          if (!(yield* isAggregorWorkspaceOpen()))
            return yield* WorkspaceInfraServiceErrors.NoIncomingProjectSettingsError.make();

          return yield* readIncomingProjectSettings(projectPath);
        }
      );

      const findAnchorFolderEntry = Effect.fn("WorkspaceInfraService.findAnchorFolderEntry")(function* (
        folders: readonly WorkspaceFileFolder[]
      ) {
        const [firstFolder] = folders;

        return yield* Effect.succeed(
          firstFolder !== undefined && firstFolder.folderPath === anchorFolderPath
            ? firstFolder.writtenFolder
            : {path: anchorFolderPath}
        );
      });

      const editWorkspaceFileForProject = Effect.fn("WorkspaceInfraService.editWorkspaceFileForProject")(function* (
        workspaceFileContents: WorkspaceFileContents,
        incomingProject: IncomingProject
      ) {
        const anchorFolder = yield* findAnchorFolderEntry(workspaceFileContents.folders);
        const workspaceFileTextWithProjectFolder = yield* editJsonPropertyInText(
          workspaceFileContents.text,
          WORKSPACE_FOLDERS_CHANGE.FILE_KEY,
          [anchorFolder, {path: incomingProject.projectPath}]
        );
        if (Result.isFailure(incomingProject.settings)) return workspaceFileTextWithProjectFolder;

        return yield* editJsonPropertyInText(
          workspaceFileTextWithProjectFolder,
          PROJECT_SETTINGS_SYNC.WORKSPACE_FILE_SETTINGS_KEY,
          incomingProject.settings.success
        );
      });

      // VS Code confirms only folder changes it sees, so the project is taken out and put back to bring the host in step.
      const swapProjectFolderThroughNoProject = Effect.fn("WorkspaceInfraService.swapProjectFolderThroughNoProject")(
        function* (workspaceFilePath: string, incomingProject: IncomingProject) {
          yield* Effect.logWarning(
            "VS Code didn't confirm the folder change; taking the project out of the workspace and back in",
            incomingProject.projectPath
          );
          yield* saveWorkspaceFileFolders(workspaceFilePath, (workspaceFileContents) =>
            Effect.flatMap(findAnchorFolderEntry(workspaceFileContents.folders), (anchorFolder) =>
              editJsonPropertyInText(workspaceFileContents.text, WORKSPACE_FOLDERS_CHANGE.FILE_KEY, [anchorFolder])
            )
          );

          yield* saveWorkspaceFileFolders(workspaceFilePath, (workspaceFileContents) =>
            editWorkspaceFileForProject(workspaceFileContents, incomingProject)
          );
        }
      );

      // One write brings in the folder with its settings, so Peacock doesn't race a later copy; updateWorkspaceFolders wedges.
      const swapProjectFolderInWorkspaceFile = Effect.fn("WorkspaceInfraService.swapProjectFolderInWorkspaceFile")(
        function* (projectPath: ProjectPathValueObject) {
          const workspaceFilePath = yield* findSavedWorkspaceFilePath();
          const settings = yield* Effect.result(prepareIncomingProjectSettings(projectPath));
          if (Result.isSuccess(settings)) yield* writeCopiedProjectSettings(projectPath, settings.success);
          const incomingProject: IncomingProject = {projectPath, settings};

          yield* Effect.catchTag(
            saveWorkspaceFileFolders(workspaceFilePath, (workspaceFileContents) =>
              editWorkspaceFileForProject(workspaceFileContents, incomingProject)
            ),
            "TimeoutError",
            () => swapProjectFolderThroughNoProject(workspaceFilePath, incomingProject)
          );
        }
      );

      const reloadWindowForProject = Effect.fn("WorkspaceInfraService.reloadWindowForProject")(function* (
        projectPath: ProjectPathValueObject,
        sessionToReopen: EntityIdValueObject | undefined
      ) {
        yield* Effect.logWarning(
          "VS Code confirmed no folder change; reloading the window to show the project",
          projectPath
        );
        yield* writeAnchorFolderSettings(projectPath);
        if (sessionToReopen !== undefined) yield* writeSessionToReopen(sessionToReopen);

        yield* Effect.promise(() => vsCodeApi.commands.executeCommand(VS_CODE_COMMANDS.RELOAD_WINDOW));
      });

      // The anchor folder's settings follow the project after a swap, so a swap that fails leaves them with the project shown.
      const moveProjectFolderIntoWorkspace = Effect.fn("WorkspaceInfraService.moveProjectFolderIntoWorkspace")(
        function* (projectPath: ProjectPathValueObject, sessionToReopen: EntityIdValueObject | undefined) {
          if (!(yield* isSavedAnchoredWorkspace())) {
            yield* writeAnchorFolderSettings(projectPath);

            return yield* openAggregorWorkspace(projectPath, sessionToReopen);
          }
          yield* Effect.catchTag(swapProjectFolderInWorkspaceFile(projectPath), "TimeoutError", () =>
            reloadWindowForProject(projectPath, sessionToReopen)
          );

          return yield* writeAnchorFolderSettings(projectPath);
        }
      );

      // Once per project and extension host: a restarted host's extensions start from folder 0 again.
      const selectProjectFolderInExtensions = Effect.fn("WorkspaceInfraService.selectProjectFolderInExtensions")(
        function* (projectPath: ProjectPathValueObject) {
          if ((yield* Ref.getAndSet(selectedProjectPath, projectPath)) === projectPath) return;
          const installedFolderSelectCommands = Array.filter(
            FOLDER_SELECT_COMMANDS,
            (folderSelectCommand) => vsCodeApi.extensions.getExtension(folderSelectCommand.extensionId) !== undefined
          );

          yield* Effect.forEach(installedFolderSelectCommands, (folderSelectCommand) =>
            Effect.tryPromise({
              catch: (cause) => WorkspaceInfraServiceErrors.FolderSelectFailedError.make({cause}),
              try: () => vsCodeApi.commands.executeCommand(folderSelectCommand.command, vsCodeApi.Uri.file(projectPath))
            })
          );
        }
      );

      // The shown project's workspace edits reach it before it leaves.
      const switchShownProject = Effect.fn("WorkspaceInfraService.switchShownProject")(function* (
        projectPath: ProjectPathValueObject,
        sessionToReopen: EntityIdValueObject | undefined
      ) {
        yield* syncShownProjectSettings();
        yield* moveProjectFolderIntoWorkspace(projectPath, sessionToReopen);
        yield* syncShownProjectSettings();
      });

      const showOnlyProjectFolder = Effect.fn("WorkspaceInfraService.showOnlyProjectFolder")(
        function* (projectPath: ProjectPathValueObject, sessionToReopen: EntityIdValueObject | undefined) {
          const workspaceFolderPaths = yield* readWorkspaceFolderPaths();
          yield* Effect.annotateCurrentSpan({projectPath, workspaceFolderPaths});
          const projectFolderPaths = Array.filter(
            workspaceFolderPaths,
            (folderPath) => folderPath !== anchorFolderPath
          );
          const isProjectShownAlone = projectFolderPaths.length === 1 && projectFolderPaths[0] === projectPath;
          if (!isProjectShownAlone)
            yield* Semaphore.withPermits(projectSettingsLock, 1)(switchShownProject(projectPath, sessionToReopen));

          yield* selectProjectFolderInExtensions(projectPath);
        },
        Effect.ignore({log: "Warn", message: "Could not show the project in the workspace"})
      );

      // Changing folder 0 would restart every extension, so a project there stays.
      const removeProjectFolderFromWorkspaceFile = Effect.fn(
        "WorkspaceInfraService.removeProjectFolderFromWorkspaceFile"
      )(function* (workspaceFilePath: string, projectPath: ProjectPathValueObject) {
        yield* saveWorkspaceFileFolders(workspaceFilePath, (workspaceFileContents) =>
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
      });

      // Without a saved workspace file, VS Code changes the folders itself.
      const removeProjectFolderFromUnsavedWorkspace = Effect.fn(
        "WorkspaceInfraService.removeProjectFolderFromUnsavedWorkspace"
      )(function* (projectPath: ProjectPathValueObject) {
        const workspaceFolderPaths = yield* readWorkspaceFolderPaths();
        const projectFolderIndex = workspaceFolderPaths.indexOf(projectPath);
        // Changing folder 0 would restart every extension, so a project there stays.
        if (projectFolderIndex < 1) return;

        yield* updateWorkspaceFolders({deleteCount: 1, foldersToAdd: [], start: projectFolderIndex});
      });

      const removeProjectFolder = Effect.fn("WorkspaceInfraService.removeProjectFolder")(
        function* (projectPath: ProjectPathValueObject) {
          const workspaceFilePath = yield* Effect.result(findSavedWorkspaceFilePath());
          if (Result.isFailure(workspaceFilePath)) return yield* removeProjectFolderFromUnsavedWorkspace(projectPath);

          return yield* removeProjectFolderFromWorkspaceFile(workspaceFilePath.success, projectPath);
        },
        Effect.ignore({log: "Warn", message: "Could not take the project out of the workspace"})
      );

      const takeSessionToReopen = Effect.fn("WorkspaceInfraService.takeSessionToReopen")(
        function* () {
          const sessionToReopenPath = path.join(path.dirname(anchorFolderPath), SESSION_TO_REOPEN.FILE_NAME);
          const sessionToReopenText = yield* fileSystem.readFileString(sessionToReopenPath);
          yield* fileSystem.remove(sessionToReopenPath);
          const sessionToReopen = yield* Schema.decodeEffect(SessionToReopenJson)(sessionToReopenText);
          const now = yield* Clock.currentTimeMillis;
          if (now - sessionToReopen.writtenAt > SESSION_TO_REOPEN.LIFETIME_MS)
            return yield* IWorkspaceInfraServiceErrors.NoSessionToReopenError.make();

          return sessionToReopen.sessionId;
        },
        Effect.mapError(() => IWorkspaceInfraServiceErrors.NoSessionToReopenError.make())
      );

      const watchWorkspaceFolderChanges = Effect.fn("WorkspaceInfraService.watchWorkspaceFolderChanges")(function* () {
        const workspaceFolderEvents = yield* vscodeUtils.streamVsCodeEvent(
          vsCodeApi.workspace.onDidChangeWorkspaceFolders
        );

        return Stream.as(workspaceFolderEvents, undefined);
      });

      yield* Effect.forkScoped(watchProjectSettingsChanges());

      return {
        listWorkspaceFolderProjects: listWorkspaceFolderProjects(),
        removeProjectFolder,
        showOnlyProjectFolder,
        takeSessionToReopen: takeSessionToReopen(),
        workspaceFolderChanges: yield* watchWorkspaceFolderChanges()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(IWorkspaceInfraService, this.make()).pipe(
    Layer.provide(AnchorFolderUtils.layer),
    Layer.provide(NodeServices.layer)
  );
}
