import {ProjectEntity} from "@entities/project/project.entity.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {BaseRepository} from "@repositories/base/base.repository.ts";
import {Context, Effect, Layer} from "effect";

import type {AddProjectRequest} from "@entities/project/project.repository.interface.ts";

export class ProjectRepository extends Context.Service<ProjectRepository>()(
  "aggregor-app/infrastructure/repositories/project.repository/ProjectRepository",
  {
    make: Effect.fn("make")(function* () {
      const baseRepository = yield* BaseRepository;

      return yield* baseRepository.makeFor<ProjectEntity, AddProjectRequest>({
        entitySchema: ProjectEntity,
        tableModel: ProjectTableModel
      });
    })
  }
) {
  public static readonly layer = Layer.effect(IProjectRepository, ownSpans("ProjectRepository", this.make())).pipe(
    Layer.provide(BaseRepository.layer)
  );
}
