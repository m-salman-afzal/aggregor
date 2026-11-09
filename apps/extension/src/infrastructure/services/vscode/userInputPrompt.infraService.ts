import {
  FolderPickCancelledError,
  InputCancelledError,
  IUserInputPromptInfraService,
  ProjectPickCancelledError
} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Layer, Result} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {window as VsCodeWindow} from "vscode";

type Window = typeof VsCodeWindow;

const showErrorMessage = Effect.fn("UserInputPromptInfraService.showErrorMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(() => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
});

const showInformationMessage = Effect.fn("UserInputPromptInfraService.showInformationMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(() => window.showInformationMessage(`${APP_NAME}: ${message}`, ...actions));
});

const confirm = Effect.fn("UserInputPromptInfraService.confirm")(function* (
  window: Window,
  message: string,
  confirmAction: string
) {
  const pickedAction = yield* Effect.promise(() => window.showWarningMessage(message, {modal: true}, confirmAction));

  return pickedAction === confirmAction;
});

const askForText = Effect.fn("UserInputPromptInfraService.askForText")(function* (
  window: Window,
  question: string,
  value: string
) {
  const enteredText = yield* Effect.promise(() => window.showInputBox({prompt: question, value}));

  return yield* Effect.fromResult(Result.fromNullishOr(enteredText, () => InputCancelledError.make()));
});

const pickProject = Effect.fn("UserInputPromptInfraService.pickProject")(function* (
  window: Window,
  projects: readonly ProjectListItemDto[],
  placeHolder: string
) {
  const pickedItem = yield* Effect.promise(() =>
    window.showQuickPick(
      Array.map(projects, (project) => ({description: project.path, label: project.name, project})),
      {placeHolder}
    )
  );
  const {project: pickedProject} = yield* Effect.fromResult(
    Result.fromNullishOr(pickedItem, () => ProjectPickCancelledError.make())
  );

  return pickedProject;
});

const pickProjectFolderPaths = Effect.fn("UserInputPromptInfraService.pickProjectFolderPaths")(function* (
  window: Window
) {
  const pickedFolderUris = yield* Effect.promise(() =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: PROJECT_LABELS.ADD_FOLDERS
    })
  );
  const confirmedFolderUris = yield* Effect.fromResult(
    Result.fromNullishOr(pickedFolderUris, () => FolderPickCancelledError.make())
  );

  return Array.map(confirmedFolderUris, (folderUri) => ProjectPathValueObjectSchema.make(folderUri.fsPath));
});

const makeUserInputPromptInfraService = Effect.fn("UserInputPromptInfraService.make")(function* () {
  const {window} = yield* VsCodeApi;

  return {
    askForText: (question: string, value: string) => askForText(window, question, value),
    confirm: (message: string, confirmAction: string) => confirm(window, message, confirmAction),
    pickProject: (projects: readonly ProjectListItemDto[], placeHolder: string) =>
      pickProject(window, projects, placeHolder),
    pickProjectFolderPaths: pickProjectFolderPaths(window),
    showErrorMessage: (message: string, ...actions: string[]) => showErrorMessage(window, message, actions),
    showInformationMessage: (message: string, ...actions: string[]) => showInformationMessage(window, message, actions)
  };
});

export const UserInputPromptInfraService = Layer.effect(
  IUserInputPromptInfraService,
  makeUserInputPromptInfraService()
);
