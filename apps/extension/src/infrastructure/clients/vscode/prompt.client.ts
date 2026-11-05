import {PromptClient} from "@/application/clients/prompt.client.ts";
import {FolderPickCancelled, ProjectPickCancelled} from "@/application/errors/project.error.ts";
import {ProjectPathSchema} from "@/domain/value-objects/project-path.value-object.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {ACTIONS, PROJECT_LABELS} from "@pkg/constants/src/message.constant.ts";
import {Effect, Layer, Result} from "effect";

import type {Project} from "@/domain/entities/project/project.entity.ts";
import type {window as VsCodeWindow} from "vscode";

type Window = typeof VsCodeWindow;

const showErrorMessage = Effect.fn("PromptClient.showErrorMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(async () => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
});

const confirm = Effect.fn("PromptClient.confirm")(function* (window: Window, message: string, confirmAction: string) {
  const pickedAction = yield* Effect.promise(async () =>
    window.showWarningMessage(message, {modal: true}, confirmAction)
  );

  return pickedAction === confirmAction;
});

const pickProject = Effect.fn("PromptClient.pickProject")(function* (window: Window, projects: readonly Project[]) {
  const pickedItem = yield* Effect.promise(async () =>
    window.showQuickPick(
      projects.map((project) => ({description: project.path, label: project.name, project})),
      {placeHolder: PROJECT_LABELS.PICK}
    )
  );
  const {project: pickedProject} = yield* Effect.fromResult(
    Result.fromNullishOr(pickedItem, () => new ProjectPickCancelled())
  );

  return pickedProject;
});

const pickProjectFolderPaths = Effect.fn("PromptClient.pickProjectFolderPaths")(function* (window: Window) {
  const pickedFolderUris = yield* Effect.promise(async () =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: ACTIONS.ADD_PROJECT
    })
  );
  const confirmedFolderUris = yield* Effect.fromResult(
    Result.fromNullishOr(pickedFolderUris, () => new FolderPickCancelled())
  );

  return confirmedFolderUris.map((folderUri) => ProjectPathSchema.make(folderUri.fsPath));
});

const makePromptClientOnVsCode = Effect.fn("PromptClient.make")(function* () {
  const {window} = yield* VsCodeService;

  return {
    confirm: (message: string, confirmAction: string) => confirm(window, message, confirmAction),
    pickProject: (projects: readonly Project[]) => pickProject(window, projects),
    pickProjectFolderPaths: () => pickProjectFolderPaths(window),
    showErrorMessage: (message: string, ...actions: string[]) => showErrorMessage(window, message, actions)
  };
});

export const PromptClientOnVsCode = Layer.effect(PromptClient, makePromptClientOnVsCode());
