import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer, Match} from "effect";

import type {ProjectService} from "@services/project.service.ts";

type ProjectCommandError = Effect.Error<ProjectService["Service"]["addProject"]>;

export class ProjectErrorMessage extends Context.Service<ProjectErrorMessage>()(
  "aggregor-app/presentation/errorMessages/project.errorMessage/ProjectErrorMessage",
  {
    make: Effect.fn("make")(function* () {
      const getProjectCommandErrorMessage = Effect.fn("getProjectCommandErrorMessage")(function* (
        projectCommandError: ProjectCommandError
      ) {
        return Match.valueTags(projectCommandError, {
          DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
          DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED})
        });
      });

      return {getProjectCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("ProjectErrorMessage", this.make()));
}
