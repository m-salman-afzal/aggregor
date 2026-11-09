import {ProjectListItemDtoSchema} from "@dtos/project.dto.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {TERMINAL_LABELS} from "@pkg/constants/src/terminal.constant.ts";
import {addEntity, findEntities, updateEntity, upsertEntity} from "@services/base.service.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Result, Schema} from "effect";
import {Path} from "effect/Path";

import type {GetProjectListItemRequestDto, RemoveProjectRequestDto} from "@dtos/project.dto.ts";
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

// The window's own workspace folders, then the added projects. An added project shown as a workspace folder stays an
// added project.
export const listProjects = Effect.fn("ProjectService.listProjects")(function* () {
  const path = yield* Path;
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use(
    (workspaceInfraService) => workspaceInfraService.listWorkspaceFolderProjects
  );
  const addedProjects = yield* findEntities(IProjectRepository, {isAdded: true});
  const addedProjectPaths = new Set(Array.map(addedProjects, (addedProject) => addedProject.path));
  const ownFolderProjects = Array.filter(
    workspaceFolderProjects,
    (workspaceFolderProject) => !addedProjectPaths.has(workspaceFolderProject.path)
  );

  return [
    ...Array.map(ownFolderProjects, (ownFolderProject) =>
      ProjectListItemDtoSchema.make({isAdded: false, name: ownFolderProject.name, path: ownFolderProject.path})
    ),
    ...Array.map(addedProjects, (addedProject) =>
      ProjectListItemDtoSchema.make({isAdded: true, name: path.basename(addedProject.path), path: addedProject.path})
    )
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
