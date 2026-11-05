import {ProjectEntity} from "@entities/project/project.entity.ts";
import {decodeCommandArgument} from "@presentationUtils/commandArguments.utils.ts";
import * as ProjectService from "@services/project.service.ts";
import {Effect} from "effect";

export const addProject = Effect.fn("ProjectController.addProject")(function* () {
  yield* ProjectService.addProject();
});

// The project row's … menu passes the Project itself.
export const removeProject = Effect.fn("ProjectController.removeProject")(function* (clickedRow: unknown) {
  yield* ProjectService.removeProject(yield* decodeCommandArgument(ProjectEntity, clickedRow));
});
