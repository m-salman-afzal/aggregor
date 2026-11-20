import {
  IUserInputPromptInfraService,
  IUserInputPromptInfraServiceErrors
} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Context, Effect, Layer, Result} from "effect";

export class UserInputPromptInfraService extends Context.Service<UserInputPromptInfraService>()(
  "aggregor-app/infrastructure/services/vscode/userInputPrompt.infraService/UserInputPromptInfraService",
  {
    make: Effect.fn("UserInputPromptInfraService.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;

      const pickProjectFolderPaths = Effect.fn("UserInputPromptInfraService.pickProjectFolderPaths")(function* () {
        const pickedFolderUris = yield* Effect.promise(() =>
          vsCodeApi.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: true,
            openLabel: PROJECT_LABELS.ADD_FOLDERS
          })
        );
        const confirmedFolderUris = yield* Effect.fromResult(
          Result.fromNullishOr(pickedFolderUris, () =>
            IUserInputPromptInfraServiceErrors.FolderPickCancelledError.make()
          )
        );

        return Array.map(confirmedFolderUris, (folderUri) => ProjectPathValueObjectSchema.make(folderUri.fsPath));
      });

      return {
        pickProjectFolderPaths: pickProjectFolderPaths()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(IUserInputPromptInfraService, this.make());
}
