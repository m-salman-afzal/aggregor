import {ProjectEntity} from "@entities/project/project.entity.ts";
import {decodeCommandArgument} from "@presentationUtils/commandArguments.utils.ts";
import {addProject, removeProject} from "@services/project.service.ts";
import {Effect} from "effect";

// The view title's button; the user picks the folders.
export const addProjectsAskingForFolders = Effect.fn("ProjectController.addProjectsAskingForFolders")(function* () {
  yield* addProject();
});

// The project row's … menu passes the Project itself.
export const removeClickedProject = Effect.fn("ProjectController.removeClickedProject")(function* (
  clickedRow: unknown
) {
  const clickedProject = yield* decodeCommandArgument(ProjectEntity, clickedRow);
  yield* removeProject(clickedProject);
});
