import * as ProjectService from "@/application/project/project.service.ts";
import {Project} from "@/domain/entities/project/project.entity.ts";
import {decodeCommandArgument} from "@/presentation/utils/command-arguments.utils.ts";
import {Effect} from "effect";

export const addProject = Effect.fn("ProjectController.addProject")(function* () {
  yield* ProjectService.addProject();
});

// The project row's … menu passes the Project itself.
export const removeProject = Effect.fn("ProjectController.removeProject")(function* (clickedRow: unknown) {
  yield* ProjectService.removeProject(yield* decodeCommandArgument(Project, clickedRow));
});
