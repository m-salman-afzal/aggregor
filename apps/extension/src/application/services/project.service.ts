import {SortOrderDomainService} from "@domainServices/sortOrder.domainService.ts";
import {ProjectListItemDtoSchema} from "@dtos/project.dto.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {BaseService} from "@services/base.service.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {ProjectSettingsValueObjectSchema} from "@valueObjects/projectSettings.valueObject.ts";
import {Array, Context, Effect, Layer, Predicate, Result, Schema} from "effect";
import {Path} from "effect/Path";

import type {
  MoveProjectDownRequestDto,
  MoveProjectUpRequestDto,
  RemoveProjectRequestDto,
  SaveProjectSettingsRequestDto
} from "@dtos/project.dto.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {WorkspaceFolderProject} from "@interfaces/workspace.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class ProjectServiceErrors extends TaggedErrors({
  ProjectNotListedError: {projectPath: ProjectPathValueObjectSchema}
}) {}

export class ProjectService extends Context.Service<ProjectService>()(
  "aggregor-app/application/services/project.service/ProjectService",
  {
    make: Effect.fn("ProjectService.make")(function* () {
      const projectRepository = yield* IProjectRepository;
      const sessionRepository = yield* ISessionRepository;
      const tmuxInfraService = yield* ITmuxInfraService;
      const userInputPromptInfraService = yield* IUserInputPromptInfraService;
      const workspaceInfraService = yield* IWorkspaceInfraService;
      const path = yield* Path;
      const sortOrderDomainService = yield* SortOrderDomainService;
      const baseService = yield* BaseService;
      const projectBaseService = yield* baseService.makeFor(projectRepository);
      const sessionBaseService = yield* baseService.makeFor(sessionRepository);

      const makeAddedProjectListItem = Effect.fn("ProjectService.makeAddedProjectListItem")(function* (
        addedProject: ProjectEntity,
        addedProjectIds: readonly EntityIdValueObject[]
      ) {
        return ProjectListItemDtoSchema.make({
          canMoveDown: yield* sortOrderDomainService.canMoveDownInOrder(addedProjectIds, addedProject.id),
          canMoveUp: yield* sortOrderDomainService.canMoveUpInOrder(addedProjectIds, addedProject.id),
          isAdded: true,
          name: path.basename(addedProject.path),
          path: addedProject.path,
          settings: addedProject.settings
        });
      });

      const findProjectSettings = Effect.fn("ProjectService.findProjectSettings")(function* (
        projectPath: ProjectPathValueObject,
        storedProjects: readonly ProjectEntity[]
      ) {
        const storedProjectResult = Result.fromOption(
          Array.findFirst(storedProjects, (storedProject) => storedProject.path === projectPath),
          () => undefined
        );
        if (Result.isSuccess(storedProjectResult)) return storedProjectResult.success.settings;

        return yield* Effect.orDie(Schema.decodeEffect(ProjectSettingsValueObjectSchema)({}));
      });

      const makeOwnFolderProjectListItem = Effect.fn("ProjectService.makeOwnFolderProjectListItem")(function* (
        ownFolderProject: WorkspaceFolderProject,
        storedProjects: readonly ProjectEntity[]
      ) {
        return ProjectListItemDtoSchema.make({
          canMoveDown: false,
          canMoveUp: false,
          isAdded: false,
          name: ownFolderProject.name,
          path: ownFolderProject.path,
          settings: yield* findProjectSettings(ownFolderProject.path, storedProjects)
        });
      });

      const findSessionWorktreePaths = Effect.fn("ProjectService.findSessionWorktreePaths")(function* () {
        const storedSessions = yield* sessionBaseService.findEntities({});

        return new Set(
          Array.filter(
            Array.map(storedSessions, (storedSession) => storedSession.worktreePath),
            Predicate.isNotUndefined
          )
        );
      });

      const listProjects = Effect.fn("ProjectService.listProjects")(function* () {
        const workspaceFolderProjects = yield* workspaceInfraService.listWorkspaceFolderProjects;
        const storedProjects = yield* projectBaseService.findEntities({});
        const addedProjects = Array.filter(storedProjects, (storedProject) => storedProject.isAdded);
        const addedProjectPaths = new Set(Array.map(addedProjects, (addedProject) => addedProject.path));
        const sessionWorktreePaths = yield* findSessionWorktreePaths();
        const ownFolderProjects = Array.filter(
          workspaceFolderProjects,
          (workspaceFolderProject) =>
            !addedProjectPaths.has(workspaceFolderProject.path) &&
            !sessionWorktreePaths.has(workspaceFolderProject.path)
        );
        const addedProjectIds = Array.map(addedProjects, (addedProject) => addedProject.id);

        return [
          ...(yield* Effect.forEach(ownFolderProjects, (ownFolderProject) =>
            makeOwnFolderProjectListItem(ownFolderProject, storedProjects)
          )),
          ...(yield* Effect.forEach(addedProjects, (addedProject) =>
            makeAddedProjectListItem(addedProject, addedProjectIds)
          ))
        ];
      });

      const findProjectListItem = Effect.fn("ProjectService.findProjectListItem")(function* (
        projectPath: ProjectPathValueObject
      ) {
        const projectListItems = yield* listProjects();

        return yield* Effect.fromResult(
          Result.fromOption(
            Array.findFirst(projectListItems, (projectListItem) => projectListItem.path === projectPath),
            () => ProjectServiceErrors.ProjectNotListedError.make({projectPath})
          )
        );
      });

      const showFirstNewProject = Effect.fn("ProjectService.showFirstNewProject")(function* (
        newProjectPaths: readonly ProjectPathValueObject[]
      ) {
        const workspaceFolderProjects = yield* workspaceInfraService.listWorkspaceFolderProjects;
        const [firstNewProjectPath] = newProjectPaths;
        if (workspaceFolderProjects.length > 0 || firstNewProjectPath === undefined) return;

        yield* workspaceInfraService.showOnlyProjectFolder(firstNewProjectPath, undefined);
      });

      const addProjectPaths = Effect.fn("ProjectService.addProjectPaths")(function* (
        projectPaths: readonly ProjectPathValueObject[]
      ) {
        yield* Effect.forEach(projectPaths, (projectPath) =>
          projectBaseService.upsertEntity({isAdded: true, path: projectPath})
        );
      });

      const findOrAddProject = Effect.fn("ProjectService.findOrAddProject")(function* (
        projectPath: ProjectPathValueObject
      ) {
        const [storedProject] = yield* projectBaseService.findEntities({path: projectPath});
        if (storedProject !== undefined) return storedProject;

        return yield* projectBaseService.addEntity({isAdded: false, path: projectPath});
      });

      const addProject = Effect.fn("ProjectService.addProject")(
        function* () {
          const pickedFolderPaths = yield* userInputPromptInfraService.pickProjectFolderPaths;
          const projectListItems = yield* listProjects();
          const ownFolderProjects = Array.filter(projectListItems, (projectListItem) => !projectListItem.isAdded);
          const projectPaths = new Set(Array.map(ownFolderProjects, (ownFolderProject) => ownFolderProject.path));
          const newProjectPaths = Array.filter(
            pickedFolderPaths,
            (pickedFolderPath) => !projectPaths.has(pickedFolderPath)
          );

          yield* addProjectPaths(newProjectPaths);
          yield* showFirstNewProject(newProjectPaths);
        },
        Effect.catchTag("FolderPickCancelledError", () => Effect.void)
      );

      const listAddedProjectOrder = Effect.fn("ProjectService.listAddedProjectOrder")(function* () {
        const storedProjects = yield* projectBaseService.findEntities({});
        const addedProjects = Array.filter(storedProjects, (storedProject) => storedProject.isAdded);

        return {
          addedProjectIds: Array.map(addedProjects, (addedProject) => addedProject.id),
          addedProjectPaths: Array.map(addedProjects, (addedProject) => addedProject.path)
        };
      });

      const moveProjectUp = Effect.fn("ProjectService.moveProjectUp")(function* (request: MoveProjectUpRequestDto) {
        const addedProjectOrder = yield* listAddedProjectOrder();
        const projectIndex = addedProjectOrder.addedProjectPaths.indexOf(request.projectPath);
        const projectIdsToPlaceAtEnd = yield* sortOrderDomainService.findEntityIdsToPlaceAtEnd(
          addedProjectOrder.addedProjectIds,
          projectIndex,
          projectIndex - 1
        );
        yield* projectBaseService.placeEntitiesAtEnd(projectIdsToPlaceAtEnd);
      });

      const moveProjectDown = Effect.fn("ProjectService.moveProjectDown")(function* (
        request: MoveProjectDownRequestDto
      ) {
        const addedProjectOrder = yield* listAddedProjectOrder();
        const projectIndex = addedProjectOrder.addedProjectPaths.indexOf(request.projectPath);
        const projectIdsToPlaceAtEnd = yield* sortOrderDomainService.findEntityIdsToPlaceAtEnd(
          addedProjectOrder.addedProjectIds,
          projectIndex,
          projectIndex + 1
        );
        yield* projectBaseService.placeEntitiesAtEnd(projectIdsToPlaceAtEnd);
      });

      const saveProjectSettings = Effect.fn("ProjectService.saveProjectSettings")(
        function* (request: SaveProjectSettingsRequestDto) {
          yield* findProjectListItem(request.projectPath);
          const project = yield* findOrAddProject(request.projectPath);

          yield* projectBaseService.updateEntity(project.id, {settings: request.settings});
        },
        Effect.catchTags({EntityNotFoundError: () => Effect.void, ProjectNotListedError: () => Effect.void})
      );

      const endProjectFolderShells = Effect.fn("ProjectService.endProjectFolderShells")(function* (
        projectPath: ProjectPathValueObject,
        storedProjects: readonly ProjectEntity[]
      ) {
        const projectSessions = yield* Effect.forEach(storedProjects, (storedProject) =>
          sessionBaseService.findEntities({projectId: storedProject.id})
        );
        const worktreePaths = Array.filter(
          Array.map(Array.flatten(projectSessions), (projectSession) => projectSession.worktreePath),
          Predicate.isNotUndefined
        );

        yield* Effect.forEach(new Set([projectPath, ...worktreePaths]), (folderPath) =>
          tmuxInfraService.endFolderShell(folderPath)
        );
      });

      // Its folder leaves the workspace first: a workspace folder that isn't added is listed as one of the window's own.
      const removeProject = Effect.fn("ProjectService.removeProject")(
        function* (request: RemoveProjectRequestDto) {
          yield* workspaceInfraService.removeProjectFolder(request.projectPath);
          const storedProjects = yield* projectBaseService.findEntities({path: request.projectPath});
          yield* Effect.forEach(storedProjects, (storedProject) =>
            projectBaseService.updateEntity(storedProject.id, {isAdded: false})
          );
          yield* endProjectFolderShells(request.projectPath, storedProjects);
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      return {
        addProject: addProject(),
        addProjectPaths,
        findOrAddProject,
        findProjectListItem,
        listProjects: listProjects(),
        moveProjectDown,
        moveProjectUp,
        removeProject,
        saveProjectSettings
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(BaseService.layer));
}
