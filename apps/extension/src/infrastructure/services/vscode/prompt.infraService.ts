import {
  FolderPickCancelledError,
  ProjectPickCancelledError
} from "@/application/interfaces/prompt/prompt.infraService.error.ts";
import {IPromptInfraService} from "@/application/interfaces/prompt/prompt.infraService.interface.ts";
import {ProjectPathValueObjectSchema} from "@/domain/valueObjects/projectPath.valueObject.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {ACTIONS, PROJECT_LABELS} from "@pkg/constants/src/message.constant.ts";
import {Effect, Layer, Result} from "effect";

import type {ProjectEntity} from "@/domain/entities/project/project.entity.ts";
import type {window as VsCodeWindow} from "vscode";

type Window = typeof VsCodeWindow;

const showErrorMessage = Effect.fn("PromptInfraService.showErrorMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(async () => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
});

const confirm = Effect.fn("PromptInfraService.confirm")(function* (
  window: Window,
  message: string,
  confirmAction: string
) {
  const pickedAction = yield* Effect.promise(async () =>
    window.showWarningMessage(message, {modal: true}, confirmAction)
  );

  return pickedAction === confirmAction;
});

const pickProject = Effect.fn("PromptInfraService.pickProject")(function* (
  window: Window,
  projects: readonly ProjectEntity[]
) {
  const pickedItem = yield* Effect.promise(async () =>
    window.showQuickPick(
      projects.map((project) => ({description: project.path, label: project.name, project})),
      {placeHolder: PROJECT_LABELS.PICK}
    )
  );
  const {project: pickedProject} = yield* Effect.fromResult(
    Result.fromNullishOr(pickedItem, () => new ProjectPickCancelledError())
  );

  return pickedProject;
});

const pickProjectFolderPaths = Effect.fn("PromptInfraService.pickProjectFolderPaths")(function* (window: Window) {
  const pickedFolderUris = yield* Effect.promise(async () =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: ACTIONS.ADD_PROJECT
    })
  );
  const confirmedFolderUris = yield* Effect.fromResult(
    Result.fromNullishOr(pickedFolderUris, () => new FolderPickCancelledError())
  );

  return confirmedFolderUris.map((folderUri) => ProjectPathValueObjectSchema.make(folderUri.fsPath));
});

const makePromptInfraService = Effect.fn("PromptInfraService.make")(function* () {
  const {window} = yield* VsCodeApi;

  return {
    confirm: (message: string, confirmAction: string) => confirm(window, message, confirmAction),
    pickProject: (projects: readonly ProjectEntity[]) => pickProject(window, projects),
    pickProjectFolderPaths: () => pickProjectFolderPaths(window),
    showErrorMessage: (message: string, ...actions: string[]) => showErrorMessage(window, message, actions)
  };
});

export const PromptInfraService = Layer.effect(IPromptInfraService, makePromptInfraService());
