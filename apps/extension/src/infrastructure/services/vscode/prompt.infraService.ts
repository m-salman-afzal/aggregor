import {
  FolderPickCancelledError,
  InputCancelledError,
  IPromptInfraService,
  ProjectPickCancelledError
} from "@interfaces/prompt.infraService.interface.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {ACTIONS} from "@pkg/constants/src/message.constant.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Array, Effect, Layer, Result} from "effect";

import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {window as VsCodeWindow} from "vscode";

type Window = typeof VsCodeWindow;

const showErrorMessage = Effect.fn("PromptInfraService.showErrorMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(() => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
});

const showInformationMessage = Effect.fn("PromptInfraService.showInformationMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(() => window.showInformationMessage(`${APP_NAME}: ${message}`, ...actions));
});

const confirm = Effect.fn("PromptInfraService.confirm")(function* (
  window: Window,
  message: string,
  confirmAction: string
) {
  const pickedAction = yield* Effect.promise(() => window.showWarningMessage(message, {modal: true}, confirmAction));

  return pickedAction === confirmAction;
});

const inputText = Effect.fn("PromptInfraService.inputText")(function* (window: Window, prompt: string, value: string) {
  const enteredText = yield* Effect.promise(() => window.showInputBox({prompt, value}));

  return yield* Effect.fromResult(Result.fromNullishOr(enteredText, () => InputCancelledError.make()));
});

const pickProject = Effect.fn("PromptInfraService.pickProject")(function* (
  window: Window,
  projects: readonly ProjectEntity[],
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

const pickProjectFolderPaths = Effect.fn("PromptInfraService.pickProjectFolderPaths")(function* (window: Window) {
  const pickedFolderUris = yield* Effect.promise(() =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: ACTIONS.ADD_PROJECT
    })
  );
  const confirmedFolderUris = yield* Effect.fromResult(
    Result.fromNullishOr(pickedFolderUris, () => FolderPickCancelledError.make())
  );

  return Array.map(confirmedFolderUris, (folderUri) => ProjectPathValueObjectSchema.make(folderUri.fsPath));
});

const makePromptInfraService = Effect.fn("PromptInfraService.make")(function* () {
  const {window} = yield* VsCodeApi;

  return {
    confirm: (message: string, confirmAction: string) => confirm(window, message, confirmAction),
    inputText: (prompt: string, value: string) => inputText(window, prompt, value),
    pickProject: (projects: readonly ProjectEntity[], placeHolder: string) =>
      pickProject(window, projects, placeHolder),
    pickProjectFolderPaths: pickProjectFolderPaths(window),
    showErrorMessage: (message: string, ...actions: string[]) => showErrorMessage(window, message, actions),
    showInformationMessage: (message: string, ...actions: string[]) => showInformationMessage(window, message, actions)
  };
});

export const PromptInfraService = Layer.effect(IPromptInfraService, makePromptInfraService());
