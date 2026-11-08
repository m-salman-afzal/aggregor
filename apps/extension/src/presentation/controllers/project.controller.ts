import {decodeCommandArgument} from "@presentationUtils/commandArguments.utils.ts";
import {addProject, newProjectTerminal, removeProject} from "@services/project.service.ts";
import {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";
import {Effect} from "effect";

// The view title's button; the user picks the folders.
export const addProjectsAskingForFolders = Effect.fn("ProjectController.addProjectsAskingForFolders")(function* () {
  yield* addProject();
});

// The project row's … menu passes the Project itself.
export const removeChosenProject = Effect.fn("ProjectController.removeChosenProject")(function* (projectRow: unknown) {
  const chosenProject = yield* decodeCommandArgument(ListedProjectValueObject, projectRow);
  yield* removeProject(chosenProject);
});

// The Terminal panel's title button; the user picks the project.
export const newProjectTerminalAskingForProject = Effect.fn("ProjectController.newProjectTerminalAskingForProject")(
  function* () {
    yield* newProjectTerminal();
  }
);
