import {Context} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {SubscriptionRef} from "effect";

export type AddProjectRequest = Pick<ProjectEntity, "added" | "path">;

export class IProjectRepository extends Context.Service<
  IProjectRepository,
  {
    // The added projects, in `sortId` order, read again after each write.
    readonly addedProjectPaths: SubscriptionRef.SubscriptionRef<readonly ProjectPathValueObject[]>;
  } & IBaseRepository<ProjectEntity, AddProjectRequest>
>()("aggregor-app/domain/entities/project/project.repository.interface/IProjectRepository") {}
