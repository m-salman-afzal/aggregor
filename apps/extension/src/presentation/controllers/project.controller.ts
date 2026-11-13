import {
  MoveProjectDownRequestDtoSchema,
  MoveProjectToPlaceOfRequestDtoSchema,
  MoveProjectUpRequestDtoSchema,
  RemoveProjectRequestDtoSchema
} from "@dtos/project.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {decodeProjectNodeRequest} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  addProject,
  listProjects,
  moveProjectDown,
  moveProjectToPlaceOf,
  moveProjectUp,
  newProjectTerminal,
  removeProject
} from "@services/project.service.ts";
import {Effect} from "effect";

export const addProjectsAskingForFolders = Effect.fn("ProjectController.addProjectsAskingForFolders")(function* () {
  yield* addProject();
});

export const removeChosenProject = Effect.fn("ProjectController.removeChosenProject")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(RemoveProjectRequestDtoSchema, projectNodeId);
  yield* removeProject(request);
});

export const moveChosenProjectUp = Effect.fn("ProjectController.moveChosenProjectUp")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(MoveProjectUpRequestDtoSchema, projectNodeId);
  yield* moveProjectUp(request);
});

export const moveChosenProjectDown = Effect.fn("ProjectController.moveChosenProjectDown")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(MoveProjectDownRequestDtoSchema, projectNodeId);
  yield* moveProjectDown(request);
});

export const moveProjectToPlaceOfForSessionsView = Effect.fn("ProjectController.moveProjectToPlaceOfForSessionsView")(
  function* (projectPath: string, placeOfProjectPath: string) {
    const request = yield* decodeVsCodeArgument(MoveProjectToPlaceOfRequestDtoSchema, {
      placeOfProjectPath,
      projectPath
    });
    yield* moveProjectToPlaceOf(request);
  }
);

export const newProjectTerminalAskingForProject = Effect.fn("ProjectController.newProjectTerminalAskingForProject")(
  function* () {
    yield* newProjectTerminal();
  }
);

export const listProjectsForSessionsView = Effect.fn("ProjectController.listProjectsForSessionsView")(function* () {
  return yield* listProjects();
});
