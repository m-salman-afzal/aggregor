import {
  canMoveDownInOrder,
  canMoveUpInOrder,
  findEntityIdsToPlaceAtEnd
} from "@domainServices/sortOrder.domainService.ts";
import {ProjectListItemDtoSchema} from "@dtos/project.dto.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {addEntity, findEntities, placeEntitiesAtEnd, updateEntity, upsertEntity} from "@services/base.service.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {ProjectSettingsValueObjectSchema} from "@valueObjects/projectSettings.valueObject.ts";
import {Array, Effect, Predicate, Result, Schema} from "effect";
import {Path} from "effect/Path";

import type {
  MoveProjectDownRequestDto,
  MoveProjectUpRequestDto,
  NewProjectTerminalRequestDto,
  RemoveProjectRequestDto,
  SaveProjectSettingsRequestDto
} from "@dtos/project.dto.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class ProjectNotListedError extends Schema.TaggedError<ProjectNotListedError, {readonly brand: unique symbol}>()(
  "ProjectNotListedError",
  {projectPath: ProjectPathValueObjectSchema}
) {}

const toAddedProjectListItem = Effect.fn("ProjectService.toAddedProjectListItem")(function* (
  addedProject: ProjectEntity,
  addedProjectIds: readonly EntityIdValueObject[]
) {
  const path = yield* Path;

  return ProjectListItemDtoSchema.make({
    canMoveDown: yield* canMoveDownInOrder(addedProjectIds, addedProject.id),
    canMoveUp: yield* canMoveUpInOrder(addedProjectIds, addedProject.id),
    isAdded: true,
    name: path.basename(addedProject.path),
    path: addedProject.path,
    settings: addedProject.settings
  });
});

// A listed project has no stored row until its first session or its settings are saved.
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

const findSessionWorktreePaths = Effect.fn("ProjectService.findSessionWorktreePaths")(function* () {
  const storedSessions = yield* findEntities(ISessionRepository, {});

  return new Set(
    Array.filter(
      Array.map(storedSessions, (storedSession) => storedSession.worktreePath),
      Predicate.isNotUndefined
    )
  );
});

// An added project shown in the window stays an added project, and a session's worktree shown there is no project.
export const listProjects = Effect.fn("ProjectService.listProjects")(function* () {
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use(
    (workspaceInfraService) => workspaceInfraService.listWorkspaceFolderProjects
  );
  const storedProjects = yield* findEntities(IProjectRepository, {});
  const addedProjects = Array.filter(storedProjects, (storedProject) => storedProject.isAdded);
  const addedProjectPaths = new Set(Array.map(addedProjects, (addedProject) => addedProject.path));
  const sessionWorktreePaths = yield* findSessionWorktreePaths();
  const ownFolderProjects = Array.filter(
    workspaceFolderProjects,
    (workspaceFolderProject) =>
      !addedProjectPaths.has(workspaceFolderProject.path) && !sessionWorktreePaths.has(workspaceFolderProject.path)
  );
  const addedProjectIds = Array.map(addedProjects, (addedProject) => addedProject.id);

  return [
    ...(yield* Effect.forEach(ownFolderProjects, (ownFolderProject) =>
      Effect.map(findProjectSettings(ownFolderProject.path, storedProjects), (settings) =>
        ProjectListItemDtoSchema.make({
          canMoveDown: false,
          canMoveUp: false,
          isAdded: false,
          name: ownFolderProject.name,
          path: ownFolderProject.path,
          settings
        })
      )
    )),
    ...(yield* Effect.forEach(addedProjects, (addedProject) => toAddedProjectListItem(addedProject, addedProjectIds)))
  ];
});

export const findProjectListItem = Effect.fn("ProjectService.findProjectListItem")(function* (
  projectPath: ProjectPathValueObject
) {
  const projectListItems = yield* listProjects();

  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(projectListItems, (projectListItem) => projectListItem.path === projectPath),
      () => ProjectNotListedError.make({projectPath})
    )
  );
});

// Opening Aggregor's workspace reloads the window; nothing runs there yet.
const showFirstNewProject = Effect.fn("ProjectService.showFirstNewProject")(function* (
  newProjectPaths: readonly ProjectPathValueObject[]
) {
  const workspaceInfraService = yield* IWorkspaceInfraService;
  const workspaceFolderProjects = yield* workspaceInfraService.listWorkspaceFolderProjects;
  const [firstNewProjectPath] = newProjectPaths;
  if (workspaceFolderProjects.length > 0 || firstNewProjectPath === undefined) return;

  yield* workspaceInfraService.showOnlyProjectFolder(firstNewProjectPath, undefined);
});

export const addProjectPaths = Effect.fn("ProjectService.addProjectPaths")(function* (
  projectPaths: readonly ProjectPathValueObject[]
) {
  yield* Effect.forEach(projectPaths, (projectPath) =>
    upsertEntity(IProjectRepository, {isAdded: true, path: projectPath})
  );
});

// A workspace folder's new row is not added, so the folder stays one of the window's own.
export const findOrAddProject = Effect.fn("ProjectService.findOrAddProject")(function* (
  projectPath: ProjectPathValueObject
) {
  const [storedProject] = yield* findEntities(IProjectRepository, {path: projectPath});
  if (storedProject !== undefined) return storedProject;

  return yield* addEntity(IProjectRepository, {isAdded: false, path: projectPath});
});

// ponytail: any folder counts as a project, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addProject = Effect.fn("ProjectService.addProject")(
  function* () {
    const pickedFolderPaths = yield* IUserInputPromptInfraService.use(
      (userInputPromptInfraService) => userInputPromptInfraService.pickProjectFolderPaths
    );
    // One of the window's own folders is listed already.
    const projectListItems = yield* listProjects();
    const ownFolderProjects = Array.filter(projectListItems, (projectListItem) => !projectListItem.isAdded);
    const projectPaths = new Set(Array.map(ownFolderProjects, (ownFolderProject) => ownFolderProject.path));
    const newProjectPaths = Array.filter(pickedFolderPaths, (pickedFolderPath) => !projectPaths.has(pickedFolderPath));

    yield* addProjectPaths(newProjectPaths);
    yield* showFirstNewProject(newProjectPaths);
  },
  Effect.catchTag("FolderPickCancelledError", () => Effect.void)
);

const listAddedProjectOrder = Effect.fn("ProjectService.listAddedProjectOrder")(function* () {
  const storedProjects = yield* findEntities(IProjectRepository, {});
  const addedProjects = Array.filter(storedProjects, (storedProject) => storedProject.isAdded);

  return {
    addedProjectIds: Array.map(addedProjects, (addedProject) => addedProject.id),
    addedProjectPaths: Array.map(addedProjects, (addedProject) => addedProject.path)
  };
});

export const moveProjectUp = Effect.fn("ProjectService.moveProjectUp")(function* (request: MoveProjectUpRequestDto) {
  const addedProjectOrder = yield* listAddedProjectOrder();
  const projectIndex = addedProjectOrder.addedProjectPaths.indexOf(request.projectPath);
  const projectIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(
    addedProjectOrder.addedProjectIds,
    projectIndex,
    projectIndex - 1
  );
  yield* placeEntitiesAtEnd(IProjectRepository, projectIdsToPlaceAtEnd);
});

export const moveProjectDown = Effect.fn("ProjectService.moveProjectDown")(function* (
  request: MoveProjectDownRequestDto
) {
  const addedProjectOrder = yield* listAddedProjectOrder();
  const projectIndex = addedProjectOrder.addedProjectPaths.indexOf(request.projectPath);
  const projectIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(
    addedProjectOrder.addedProjectIds,
    projectIndex,
    projectIndex + 1
  );
  yield* placeEntitiesAtEnd(IProjectRepository, projectIdsToPlaceAtEnd);
});

// A listed project without a stored row gets one here, left unadded so its place in the list stays.
export const saveProjectSettings = Effect.fn("ProjectService.saveProjectSettings")(
  function* (request: SaveProjectSettingsRequestDto) {
    yield* findProjectListItem(request.projectPath);
    const project = yield* findOrAddProject(request.projectPath);

    yield* updateEntity(IProjectRepository, project.id, {settings: request.settings});
  },
  Effect.catchTags({EntityNotFoundError: () => Effect.void, ProjectNotListedError: () => Effect.void})
);

// Its folder leaves the workspace first: a workspace folder that isn't added is listed as one of the window's own.
export const removeProject = Effect.fn("ProjectService.removeProject")(
  function* (request: RemoveProjectRequestDto) {
    yield* IWorkspaceInfraService.use((workspaceInfraService) =>
      workspaceInfraService.removeProjectFolder(request.projectPath)
    );
    const storedProjects = yield* findEntities(IProjectRepository, {path: request.projectPath});
    yield* Effect.forEach(storedProjects, (storedProject) =>
      updateEntity(IProjectRepository, storedProject.id, {isAdded: false})
    );
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void)
);

// A project no longer listed opens nothing.
export const newProjectTerminal = Effect.fn("ProjectService.newProjectTerminal")(
  function* (request: NewProjectTerminalRequestDto) {
    const chosenProject = yield* findProjectListItem(request.projectPath);

    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.openProjectTerminal(chosenProject));
  },
  Effect.catchTag("ProjectNotListedError", () => Effect.void)
);
