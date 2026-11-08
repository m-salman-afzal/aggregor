import {ProjectEntity} from "@entities/project/project.entity.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {makeBaseRepository} from "@repositories/base/base.repository.ts";
import {Effect, Layer} from "effect";

import type {AddProjectRequest} from "@entities/project/project.repository.interface.ts";

const makeProjectRepository = Effect.fn("ProjectRepository.make")(function* () {
  return yield* makeBaseRepository<ProjectEntity, AddProjectRequest>({
    entitySchema: ProjectEntity,
    tableModel: ProjectTableModel
  });
});

export const ProjectRepository = Layer.effect(IProjectRepository, makeProjectRepository());
