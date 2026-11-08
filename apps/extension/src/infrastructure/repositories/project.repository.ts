import {ProjectEntity} from "@entities/project/project.entity.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {makeBaseRepository} from "@repositories/base/base.repository.ts";
import {showRepositoryError} from "@services/base.service.ts";
import {Array, Context, Effect, Layer, SubscriptionRef} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {AddProjectRequest} from "@entities/project/project.repository.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

type ProjectBaseRepository = IBaseRepository<ProjectEntity, AddProjectRequest>;

type ProjectPathsReference = SubscriptionRef.SubscriptionRef<readonly ProjectPathValueObject[]>;

const refreshAddedProjectPaths = Effect.fn("ProjectRepository.refreshAddedProjectPaths")(function* (
  projectBaseRepository: ProjectBaseRepository,
  addedProjectPaths: ProjectPathsReference
) {
  const addedProjects = yield* projectBaseRepository.findMany({added: true});
  yield* SubscriptionRef.set(
    addedProjectPaths,
    Array.map(addedProjects, (project) => project.path)
  );
}, Effect.catch(showRepositoryError));

const makeProjectRepository = Effect.fn("ProjectRepository.make")(function* () {
  const projectBaseRepository = yield* makeBaseRepository<ProjectEntity, AddProjectRequest>({
    entitySchema: ProjectEntity,
    tableModel: ProjectTableModel
  });
  const addedProjectPaths: ProjectPathsReference = yield* SubscriptionRef.make<readonly ProjectPathValueObject[]>([]);
  const userInputPromptInfraService = yield* IUserInputPromptInfraService;
  const userInputPromptContext = Context.make(IUserInputPromptInfraService, userInputPromptInfraService);
  const refresh = Effect.provide(
    refreshAddedProjectPaths(projectBaseRepository, addedProjectPaths),
    userInputPromptContext
  );
  yield* refresh;
  const refreshAfter = <Success, Failure>(write: Effect.Effect<Success, Failure>) => Effect.tap(write, () => refresh);

  return {
    ...projectBaseRepository,
    add: (addRequest: AddProjectRequest) => refreshAfter(projectBaseRepository.add(addRequest)),
    addedProjectPaths,
    softDelete: (projectId: ProjectEntity["id"]) => refreshAfter(projectBaseRepository.softDelete(projectId)),
    update: (projectId: ProjectEntity["id"], changes: Partial<AddProjectRequest>) =>
      refreshAfter(projectBaseRepository.update(projectId, changes)),
    upsert: (addRequest: AddProjectRequest) => refreshAfter(projectBaseRepository.upsert(addRequest))
  };
});

export const ProjectRepository = Layer.effect(IProjectRepository, makeProjectRepository());
