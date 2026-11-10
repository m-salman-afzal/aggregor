import {
  GetProjectListItemRequestDtoSchema,
  MoveProjectDownRequestDtoSchema,
  MoveProjectToPlaceOfRequestDtoSchema,
  MoveProjectUpRequestDtoSchema,
  RemoveProjectRequestDtoSchema
} from "@dtos/project.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {decodeProjectNodeRequest} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  addProject,
  getProjectListItem,
  listProjects,
  moveProjectDown,
  moveProjectToPlaceOf,
  moveProjectUp,
  newProjectTerminal,
  removeProject
} from "@services/project.service.ts";
import {Effect} from "effect";

// The view title's button; the user picks the folders.
export const addProjectsAskingForFolders = Effect.fn("ProjectController.addProjectsAskingForFolders")(function* () {
  yield* addProject();
});

// The added project row's … menu passes the row's node id.
export const removeChosenProject = Effect.fn("ProjectController.removeChosenProject")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(RemoveProjectRequestDtoSchema, projectNodeId);
  yield* removeProject(request);
});

// The added project row's … menu passes the row's node id.
export const moveChosenProjectUp = Effect.fn("ProjectController.moveChosenProjectUp")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(MoveProjectUpRequestDtoSchema, projectNodeId);
  yield* moveProjectUp(request);
});

// The added project row's … menu passes the row's node id.
export const moveChosenProjectDown = Effect.fn("ProjectController.moveChosenProjectDown")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(MoveProjectDownRequestDtoSchema, projectNodeId);
  yield* moveProjectDown(request);
});

// A project row dropped on another project row.
export const moveProjectToPlaceOfForSessionsView = Effect.fn("ProjectController.moveProjectToPlaceOfForSessionsView")(
  function* (projectPath: string, placeOfProjectPath: string) {
    const request = yield* decodeVsCodeArgument(MoveProjectToPlaceOfRequestDtoSchema, {
      placeOfProjectPath,
      projectPath
    });
    yield* moveProjectToPlaceOf(request);
  }
);

// The Terminal panel's title button; the user picks the project.
export const newProjectTerminalAskingForProject = Effect.fn("ProjectController.newProjectTerminalAskingForProject")(
  function* () {
    yield* newProjectTerminal();
  }
);

export const listProjectsForSessionsView = Effect.fn("ProjectController.listProjectsForSessionsView")(function* () {
  return yield* listProjects();
});

export const getProjectListItemForSessionsView = Effect.fn("ProjectController.getProjectListItemForSessionsView")(
  function* (projectPath: string) {
    const request = yield* decodeVsCodeArgument(GetProjectListItemRequestDtoSchema, {projectPath});

    return yield* getProjectListItem(request);
  }
);

export const getProjectListItemForArchiveView = Effect.fn("ProjectController.getProjectListItemForArchiveView")(
  function* (projectPath: string) {
    const request = yield* decodeVsCodeArgument(GetProjectListItemRequestDtoSchema, {projectPath});

    return yield* getProjectListItem(request);
  }
);
