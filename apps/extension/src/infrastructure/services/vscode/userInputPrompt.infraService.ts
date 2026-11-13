import {
  FolderPickCancelledError,
  IUserInputPromptInfraService
} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Layer, Result} from "effect";

import type {window as VsCodeWindow} from "vscode";

type Window = typeof VsCodeWindow;

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
  const vsCodeApi = yield* VsCodeApi;

  return {
    pickProjectFolderPaths: pickProjectFolderPaths(vsCodeApi.window)
  };
});

export const UserInputPromptInfraService = Layer.effect(
  IUserInputPromptInfraService,
  makeUserInputPromptInfraService()
);
