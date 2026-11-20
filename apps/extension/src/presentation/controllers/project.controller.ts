import {
  MoveProjectDownRequestDtoSchema,
  MoveProjectUpRequestDtoSchema,
  RemoveProjectRequestDtoSchema,
  SaveProjectSettingsRequestDtoSchema
} from "@dtos/project.dto.ts";
import {ProjectErrorMessage} from "@errorMessages/project.errorMessage.ts";
import {RegisterCommandMiddleware} from "@middlewares/registerCommand.middleware.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {ProjectService} from "@services/project.service.ts";
import {Context, Effect, Layer} from "effect";

export class ProjectController extends Context.Service<ProjectController>()(
  "aggregor-app/presentation/controllers/project.controller/ProjectController",
  {
    make: Effect.fn("make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const projectService = yield* ProjectService;
      const projectErrorMessage = yield* ProjectErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const addProjectsAskingForFolders = Effect.fn("addProjectsAskingForFolders")(function* () {
        yield* projectService.addProject;
      });

      const removeChosenProject = Effect.fn("removeChosenProject")(function* (chosenProject: unknown) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(RemoveProjectRequestDtoSchema, chosenProject);
        yield* projectService.removeProject(request);
      });

      const moveChosenProjectUp = Effect.fn("moveChosenProjectUp")(function* (chosenProject: unknown) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(MoveProjectUpRequestDtoSchema, chosenProject);
        yield* projectService.moveProjectUp(request);
      });

      const moveChosenProjectDown = Effect.fn("moveChosenProjectDown")(function* (chosenProject: unknown) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(MoveProjectDownRequestDtoSchema, chosenProject);
        yield* projectService.moveProjectDown(request);
      });

      const saveChosenProjectSettings = Effect.fn("saveChosenProjectSettings")(function* (chosenProject: unknown) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(SaveProjectSettingsRequestDtoSchema, chosenProject);
        yield* projectService.saveProjectSettings(request);
      });

      yield* registerCommandMiddleware.registerCommand(
        PROJECT_COMMANDS.ADD,
        addProjectsAskingForFolders,
        projectErrorMessage.getProjectCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        PROJECT_COMMANDS.MOVE_DOWN,
        moveChosenProjectDown,
        projectErrorMessage.getProjectCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        PROJECT_COMMANDS.MOVE_UP,
        moveChosenProjectUp,
        projectErrorMessage.getProjectCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        PROJECT_COMMANDS.REMOVE,
        removeChosenProject,
        projectErrorMessage.getProjectCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        PROJECT_COMMANDS.SAVE_SETTINGS,
        saveChosenProjectSettings,
        projectErrorMessage.getProjectCommandErrorMessage
      );

      return {
        addProjectsAskingForFolders: addProjectsAskingForFolders(),
        moveChosenProjectDown,
        moveChosenProjectUp,
        removeChosenProject,
        saveChosenProjectSettings
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("ProjectController", this.make())).pipe(
    Layer.provide([ProjectErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
