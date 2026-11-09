import {GetProjectListItemRequestDtoSchema, RemoveProjectRequestDtoSchema} from "@dtos/project.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {decodeProjectNodeRequest} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  addProject,
  getProjectListItem,
  listProjects,
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
