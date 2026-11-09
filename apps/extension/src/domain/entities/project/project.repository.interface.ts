import {Context} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";

export type AddProjectRequest = Pick<ProjectEntity, "isAdded" | "path">;

export class IProjectRepository extends Context.Service<
  IProjectRepository,
  IBaseRepository<ProjectEntity, AddProjectRequest>
>()("aggregor-app/domain/entities/project/project.repository.interface/IProjectRepository") {}
