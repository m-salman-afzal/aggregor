import {Context, Effect, Layer, Match} from "effect";

import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {PROJECT_ERRORS} from "@pkg/constants/src/project.constant.ts";

import type {ProjectService} from "@/services/project.service.ts";

type ProjectCommandError =
  | Effect.Error<ProjectService["Service"]["addProject"]>
  | Effect.Error<ReturnType<ProjectService["Service"]["addProjectFolder"]>>;

export class ProjectErrorMessage extends Context.Service<ProjectErrorMessage>()(
  "aggregor-app/presentation/errorMessages/project.errorMessage/ProjectErrorMessage",
  {
    make: Effect.fn("ProjectErrorMessage.make")(function* () {
      const getProjectCommandErrorMessage = Effect.fn("ProjectErrorMessage.getProjectCommandErrorMessage")(function* (
        projectCommandError: ProjectCommandError
      ) {
        return Match.valueTags(projectCommandError, {
          DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
          DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
          ProjectFolderNotFoundError: (error) => ({message: PROJECT_ERRORS.FOLDER_NOT_FOUND(error.projectPath)})
        });
      });

      return {getProjectCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
