import {WindowEntity} from "@entities/window/window.entity.ts";
import {IWindowRepository} from "@entities/window/window.repository.interface.ts";
import {WindowProjectEntity} from "@entities/windowProject/windowProject.entity.ts";
import {findWindowKey} from "@infraUtils/anchorFolder.utils.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {WindowTableModel} from "@models/window.model.ts";
import {WindowProjectTableModel} from "@models/windowProject.model.ts";
import {makeBaseRepository} from "@repositories/base/base.repository.ts";
import {showRepositoryError} from "@services/base.service.ts";
import {eq} from "drizzle-orm";
import {Array, Context, Effect, Layer, SubscriptionRef} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {AddWindowRequest} from "@entities/window/window.repository.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

type AddWindowProjectRequest = Pick<WindowProjectEntity, "projectId" | "windowId">;

interface CurrentWindowProjects {
  readonly addedProjectPaths: SubscriptionRef.SubscriptionRef<readonly ProjectPathValueObject[]>;
  readonly currentWindow: WindowEntity;
  readonly windowProjectRepository: IBaseRepository<WindowProjectEntity, AddWindowProjectRequest>;
}

const WINDOW_PROJECT_PROJECT_JOIN = {
  joinCondition: eq(ProjectTableModel.id, WindowProjectTableModel.projectId),
  joinedColumns: {projectPath: ProjectTableModel.path},
  joinedTable: ProjectTableModel
};

const refreshAddedProjectPaths = Effect.fn("WindowRepository.refreshAddedProjectPaths")(function* ({
  addedProjectPaths,
  currentWindow,
  windowProjectRepository
}: CurrentWindowProjects) {
  const windowProjects = yield* windowProjectRepository.findMany({windowId: currentWindow.id});
  yield* SubscriptionRef.set(
    addedProjectPaths,
    Array.map(windowProjects, (windowProject) => windowProject.projectPath)
  );
}, Effect.catch(showRepositoryError));

const addWindowProjects = Effect.fn("WindowRepository.addWindowProjects")(function* (
  currentWindowProjects: CurrentWindowProjects,
  projects: readonly ProjectEntity[]
) {
  const {currentWindow, windowProjectRepository} = currentWindowProjects;
  yield* Effect.forEach(projects, (project) =>
    windowProjectRepository.upsert({projectId: project.id, windowId: currentWindow.id})
  );
  yield* refreshAddedProjectPaths(currentWindowProjects);
});

const removeWindowProject = Effect.fn("WindowRepository.removeWindowProject")(function* (
  currentWindowProjects: CurrentWindowProjects,
  projectPath: ProjectPathValueObject
) {
  const {currentWindow, windowProjectRepository} = currentWindowProjects;
  const windowProjects = yield* windowProjectRepository.findMany({windowId: currentWindow.id});
  const removedWindowProjects = Array.filter(
    windowProjects,
    (windowProject) => windowProject.projectPath === projectPath
  );
  yield* Effect.forEach(removedWindowProjects, (windowProject) => windowProjectRepository.softDelete(windowProject.id));
  yield* refreshAddedProjectPaths(currentWindowProjects);
});

const makeWindowRepository = Effect.fn("WindowRepository.make")(function* () {
  const windowBaseRepository = yield* makeBaseRepository<WindowEntity, AddWindowRequest>({
    entitySchema: WindowEntity,
    tableModel: WindowTableModel
  });
  const currentWindowProjects: CurrentWindowProjects = {
    addedProjectPaths: yield* SubscriptionRef.make<readonly ProjectPathValueObject[]>([]),
    currentWindow: yield* windowBaseRepository.upsert({key: yield* findWindowKey()}),
    windowProjectRepository: yield* makeBaseRepository<WindowProjectEntity, AddWindowProjectRequest>({
      entitySchema: WindowProjectEntity,
      join: WINDOW_PROJECT_PROJECT_JOIN,
      tableModel: WindowProjectTableModel
    })
  };
  yield* refreshAddedProjectPaths(currentWindowProjects);
  const userInputPromptInfraService = yield* IUserInputPromptInfraService;
  const userInputPromptContext = Context.make(IUserInputPromptInfraService, userInputPromptInfraService);

  return {
    ...windowBaseRepository,
    addedProjectPaths: currentWindowProjects.addedProjectPaths,
    addProjects: (projects: readonly ProjectEntity[]) =>
      Effect.provide(addWindowProjects(currentWindowProjects, projects), userInputPromptContext),
    removeProject: (projectPath: ProjectPathValueObject) =>
      Effect.provide(removeWindowProject(currentWindowProjects, projectPath), userInputPromptContext)
  };
});

export const WindowRepository = Layer.effect(IWindowRepository, makeWindowRepository());
