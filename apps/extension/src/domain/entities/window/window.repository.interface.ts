import {Context} from "effect";

import type {DatabaseReadError, DatabaseWriteError, IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {WindowEntity} from "@entities/window/window.entity.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, SubscriptionRef} from "effect";

export type AddWindowRequest = Pick<WindowEntity, "key">;

export class IWindowRepository extends Context.Service<
  IWindowRepository,
  IBaseRepository<WindowEntity, AddWindowRequest> & {
    readonly addedProjectPaths: SubscriptionRef.SubscriptionRef<readonly ProjectPathValueObject[]>;
    readonly addProjects: (
      projects: readonly ProjectEntity[]
    ) => Effect.Effect<void, DatabaseReadError | DatabaseWriteError>;
    readonly removeProject: (
      projectPath: ProjectPathValueObject
    ) => Effect.Effect<void, DatabaseReadError | DatabaseWriteError>;
  }
>()("aggregor-app/domain/entities/window/window.repository.interface/IWindowRepository") {}
