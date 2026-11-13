import {
  canMoveDownInOrder,
  canMoveUpInOrder,
  findEntityIdsToPlaceAtEnd
} from "@domainServices/sortOrder.domainService.ts";
import {ProjectListItemDtoSchema} from "@dtos/project.dto.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {TERMINAL_LABELS} from "@pkg/constants/src/terminal.constant.ts";
import {addEntity, findEntities, placeEntitiesAtEnd, updateEntity, upsertEntity} from "@services/base.service.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Result, Schema} from "effect";
import {Path} from "effect/Path";

import type {
  GetProjectListItemRequestDto,
  MoveProjectDownRequestDto,
  MoveProjectToPlaceOfRequestDto,
  MoveProjectUpRequestDto,
  RemoveProjectRequestDto
} from "@dtos/project.dto.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class NoProjectError extends Schema.TaggedError<NoProjectError, {readonly brand: unique symbol}>()(
  "NoProjectError",
  {}
) {}

// The project's row was removed, or its folder left the workspace, since the user saw it.
export class ProjectNotListedError extends Schema.TaggedError<ProjectNotListedError, {readonly brand: unique symbol}>()(
  "ProjectNotListedError",
  {projectPath: ProjectPathValueObjectSchema}
) {}

// An added project moves among the added projects.
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
    path: addedProject.path
  });
});

// The window's own workspace folders, then the added projects. An added project shown as a workspace folder stays an
// added project.
export const listProjects = Effect.fn("ProjectService.listProjects")(function* () {
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use(
    (workspaceInfraService) => workspaceInfraService.listWorkspaceFolderProjects
  );
  const addedProjects = yield* findEntities(IProjectRepository, {isAdded: true});
  const addedProjectPaths = new Set(Array.map(addedProjects, (addedProject) => addedProject.path));
  const ownFolderProjects = Array.filter(
    workspaceFolderProjects,
    (workspaceFolderProject) => !addedProjectPaths.has(workspaceFolderProject.path)
  );
  const addedProjectIds = Array.map(addedProjects, (addedProject) => addedProject.id);

  return [
    ...Array.map(ownFolderProjects, (ownFolderProject) =>
      ProjectListItemDtoSchema.make({
        canMoveDown: false,
        canMoveUp: false,
        isAdded: false,
        name: ownFolderProject.name,
        path: ownFolderProject.path
      })
    ),
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

export const getProjectListItem = Effect.fn("ProjectService.getProjectListItem")(function* (
  request: GetProjectListItemRequestDto
) {
  return yield* findProjectListItem(request.projectPath);
});

// Asks only when the window has more than one project.
export const pickProject = Effect.fn("ProjectService.pickProject")(function* (placeHolder: string) {
  const projectListItems = yield* listProjects();
  if (projectListItems.length > 1)
    return yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.pickProject(projectListItems, placeHolder)
    );

  return yield* Effect.fromResult(Result.fromNullishOr(projectListItems[0], () => NoProjectError.make()));
});

// A window showing no project shows the first new one, opening Aggregor's workspace, which reloads the window; nothing
// runs there yet.
const showFirstNewProject = Effect.fn("ProjectService.showFirstNewProject")(function* (
  newProjectPaths: readonly ProjectPathValueObject[]
) {
  const workspaceInfraService = yield* IWorkspaceInfraService;
  const workspaceFolderProjects = yield* workspaceInfraService.listWorkspaceFolderProjects;
  const [firstNewProjectPath] = newProjectPaths;
  if (workspaceFolderProjects.length > 0 || firstNewProjectPath === undefined) return;

  yield* workspaceInfraService.showOnlyProjectFolder(firstNewProjectPath, undefined);
});

// Each goes to the end of the list, an added project too.
export const addProjectPaths = Effect.fn("ProjectService.addProjectPaths")(function* (
  projectPaths: readonly ProjectPathValueObject[]
) {
  yield* Effect.forEach(projectPaths, (projectPath) =>
    upsertEntity(IProjectRepository, {isAdded: true, path: projectPath})
  );
});

// Leaves an existing project where it is in the list. A workspace folder's new row is not added, so the folder stays one
// of the window's own.
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
    const ownFolderPaths = new Set(Array.map(ownFolderProjects, (ownFolderProject) => ownFolderProject.path));
    const newProjectPaths = Array.filter(
      pickedFolderPaths,
      (pickedFolderPath) => !ownFolderPaths.has(pickedFolderPath)
    );

    yield* addProjectPaths(newProjectPaths);
    yield* showFirstNewProject(newProjectPaths);
  },
  Effect.catchTag("FolderPickCancelledError", () => Effect.void)
);

// The added projects in their order: their ids, to move them, and their paths, to find one. A project that isn't added
// has no place among them.
const listAddedProjectOrder = Effect.fn("ProjectService.listAddedProjectOrder")(function* () {
  const addedProjects = yield* findEntities(IProjectRepository, {isAdded: true});

  return {
    addedProjectIds: Array.map(addedProjects, (addedProject) => addedProject.id),
    addedProjectPaths: Array.map(addedProjects, (addedProject) => addedProject.path)
  };
});

// The first added project stays where it is.
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

// The last added project stays where it is.
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

// The window's own folders don't move, so the place of one moves nothing.
export const moveProjectToPlaceOf = Effect.fn("ProjectService.moveProjectToPlaceOf")(function* (
  request: MoveProjectToPlaceOfRequestDto
) {
  const addedProjectOrder = yield* listAddedProjectOrder();
  const projectIndex = addedProjectOrder.addedProjectPaths.indexOf(request.projectPath);
  const placeIndex = addedProjectOrder.addedProjectPaths.indexOf(request.placeOfProjectPath);
  const projectIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(
    addedProjectOrder.addedProjectIds,
    projectIndex,
    placeIndex
  );
  yield* placeEntitiesAtEnd(IProjectRepository, projectIdsToPlaceAtEnd);
});

// Its sessions stay saved and their open tabs keep running; adding the project again lists them again. Its folder leaves
// the workspace first, since a workspace folder that is not added is listed as one of the window's own.
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

// A shell in any of the window's projects, shown in the workspace or not; asks which when there is more than one.
export const newProjectTerminal = Effect.fn("ProjectService.newProjectTerminal")(
  function* () {
    const pickedProject = yield* pickProject(TERMINAL_LABELS.PICK_PROJECT);

    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.openProjectTerminal(pickedProject));
  },
  Effect.catchTag("ProjectPickCancelledError", () => Effect.void)
);
