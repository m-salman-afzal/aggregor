import {Context, Effect, Layer} from "effect";

import {ProjectEntity} from "@/entities/project/project.entity.ts";
import {IProjectRepository} from "@/entities/project/project.repository.interface.ts";
import {ProjectTableModel} from "@/models/project.model.ts";
import {BaseRepository} from "@/repositories/base/base.repository.ts";

import type {AddProjectRequest} from "@/entities/project/project.repository.interface.ts";

export class ProjectRepository extends Context.Service<ProjectRepository>()(
  "aggregor-app/infrastructure/repositories/project.repository/ProjectRepository",
  {
    make: Effect.fn("ProjectRepository.make")(function* () {
      const baseRepository = yield* BaseRepository;

      return yield* baseRepository.makeForTable<ProjectEntity, AddProjectRequest>({
        entitySchema: ProjectEntity,
        tableModel: ProjectTableModel
      });
    })
  }
) {
  public static readonly layer = Layer.effect(IProjectRepository, this.make()).pipe(
    Layer.provide(BaseRepository.layer)
  );
}
