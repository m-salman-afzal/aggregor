import {Context, Effect, Layer} from "effect";

import {
  AddProjectFolderRequestDtoSchema,
  MoveProjectDownRequestDtoSchema,
  MoveProjectUpRequestDtoSchema,
  RemoveProjectRequestDtoSchema,
  SaveProjectSettingsRequestDtoSchema
} from "@/dtos/project.dto.ts";
import {ProjectErrorMessage} from "@/errorMessages/project.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {ProjectService} from "@/services/project.service.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";

import type {
  AddProjectFolderRequestDto,
  MoveProjectDownRequestDto,
  MoveProjectUpRequestDto,
  RemoveProjectRequestDto,
  SaveProjectSettingsRequestDto
} from "@/dtos/project.dto.ts";

export class ProjectController extends Context.Service<ProjectController>()(
  "aggregor-app/presentation/controllers/project.controller/ProjectController",
  {
    make: Effect.fn("ProjectController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const projectService = yield* ProjectService;
      const projectErrorMessage = yield* ProjectErrorMessage;

      const addProjectsAskingForFolders = Effect.fn("ProjectController.addProjectsAskingForFolders")(function* () {
        yield* projectService.addProject;
      });

      const addChosenProjectFolder = Effect.fn("ProjectController.addChosenProjectFolder")(function* (
        request: AddProjectFolderRequestDto
      ) {
        yield* projectService.addProjectFolder(request);
      });

      const removeChosenProject = Effect.fn("ProjectController.removeChosenProject")(function* (
        request: RemoveProjectRequestDto
      ) {
        yield* projectService.removeProject(request);
      });

      const moveChosenProjectUp = Effect.fn("ProjectController.moveChosenProjectUp")(function* (
        request: MoveProjectUpRequestDto
      ) {
        yield* projectService.moveProjectUp(request);
      });

      const moveChosenProjectDown = Effect.fn("ProjectController.moveChosenProjectDown")(function* (
        request: MoveProjectDownRequestDto
      ) {
        yield* projectService.moveProjectDown(request);
      });

      const saveChosenProjectSettings = Effect.fn("ProjectController.saveChosenProjectSettings")(function* (
        request: SaveProjectSettingsRequestDto
      ) {
        yield* projectService.saveProjectSettings(request);
      });

      yield* registerCommandMiddleware.registerCommandWithoutRequest({
        commandId: PROJECT_COMMANDS.ADD,
        controller: addProjectsAskingForFolders,
        getCommandErrorMessage: projectErrorMessage.getProjectCommandErrorMessage
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: PROJECT_COMMANDS.ADD_FOLDER,
        controller: addChosenProjectFolder,
        getCommandErrorMessage: projectErrorMessage.getProjectCommandErrorMessage,
        requestSchema: AddProjectFolderRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: PROJECT_COMMANDS.MOVE_DOWN,
        controller: moveChosenProjectDown,
        getCommandErrorMessage: projectErrorMessage.getProjectCommandErrorMessage,
        requestSchema: MoveProjectDownRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: PROJECT_COMMANDS.MOVE_UP,
        controller: moveChosenProjectUp,
        getCommandErrorMessage: projectErrorMessage.getProjectCommandErrorMessage,
        requestSchema: MoveProjectUpRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: PROJECT_COMMANDS.REMOVE,
        controller: removeChosenProject,
        getCommandErrorMessage: projectErrorMessage.getProjectCommandErrorMessage,
        requestSchema: RemoveProjectRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: PROJECT_COMMANDS.SAVE_SETTINGS,
        controller: saveChosenProjectSettings,
        getCommandErrorMessage: projectErrorMessage.getProjectCommandErrorMessage,
        requestSchema: SaveProjectSettingsRequestDtoSchema
      });

      return {
        addChosenProjectFolder,
        addProjectsAskingForFolders: addProjectsAskingForFolders(),
        moveChosenProjectDown,
        moveChosenProjectUp,
        removeChosenProject,
        saveChosenProjectSettings
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([ProjectErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
