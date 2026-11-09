import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {PROJECT_LABELS, TERMINAL_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {addEntity, findEntities, showRepositoryError, updateEntity, upsertEntity} from "@services/base.service.ts";
import {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";
import {Array, Effect, Match, Result, Schema, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class NoProjectError extends Schema.TaggedError<NoProjectError, {readonly brand: unique symbol}>()(
  "NoProjectError",
  {}
) {}

// The window's own workspace folders, then the added projects. The added project shown as a workspace folder stays an
// added project.
export const listProjects = Effect.fn("ProjectService.listProjects")(function* () {
  const {addedProjectPaths} = yield* IProjectRepository;
  const path = yield* Path;
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use(
    (workspaceInfraService) => workspaceInfraService.listWorkspaceFolderProjects
  );
  const currentAddedProjectPaths = yield* SubscriptionRef.get(addedProjectPaths);
  const addedProjectPathSet = new Set(currentAddedProjectPaths);
  const ownFolderProjects = Array.filter(
    workspaceFolderProjects,
    (workspaceFolderProject) => !addedProjectPathSet.has(workspaceFolderProject.path)
  );
  const addedProjects = Array.map(currentAddedProjectPaths, (addedProjectPath) =>
    ListedProjectValueObject.make({added: true, name: path.basename(addedProjectPath), path: addedProjectPath})
  );

  return [...ownFolderProjects, ...addedProjects];
});

// Asks only when the window has more than one project.
export const pickProject = Effect.fn("ProjectService.pickProject")(function* (placeHolder: string) {
  const projects = yield* listProjects();
  if (projects.length > 1)
    return yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.pickProject(projects, placeHolder)
    );

  return yield* Effect.fromResult(Result.fromNullishOr(projects[0], () => NoProjectError.make()));
});

// A window showing no project shows the first new one. An empty window gets its anchor folder that way, which keeps its
// key; the extensions restart, but nothing runs there yet.
const showFirstNewProject = Effect.fn("ProjectService.showFirstNewProject")(function* (
  newProjectPaths: readonly ProjectPathValueObject[]
) {
  const workspaceInfraService = yield* IWorkspaceInfraService;
  const workspaceFolderProjects = yield* workspaceInfraService.listWorkspaceFolderProjects;
  const [firstNewProjectPath] = newProjectPaths;
  if (workspaceFolderProjects.length > 0 || firstNewProjectPath === undefined) return;

  yield* workspaceInfraService.showOnlyProjectFolder(firstNewProjectPath);
});

// Each goes to the end of the list, an added project too.
export const addProjectPaths = Effect.fn("ProjectService.addProjectPaths")(function* (
  projectPaths: readonly ProjectPathValueObject[]
) {
  yield* Effect.forEach(projectPaths, (projectPath) =>
    upsertEntity(IProjectRepository, {added: true, path: projectPath})
  );
});

// Leaves an existing project where it is in the list. A workspace folder's new row is not added, so the folder stays one
// of the window's own.
export const findOrAddProject = Effect.fn("ProjectService.findOrAddProject")(function* (
  projectPath: ProjectPathValueObject
) {
  const [storedProject] = yield* findEntities(IProjectRepository, {path: projectPath});
  if (storedProject !== undefined) return storedProject;

  return yield* addEntity(IProjectRepository, {added: false, path: projectPath});
});

// ponytail: any folder counts as a project, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addProject = Effect.fn("ProjectService.addProject")(
  function* () {
    const pickedFolderPaths = yield* IUserInputPromptInfraService.use(
      (userInputPromptInfraService) => userInputPromptInfraService.pickProjectFolderPaths
    );
    // One of the window's own folders is listed already.
    const listedProjects = yield* listProjects();
    const ownFolderProjects = Array.filter(listedProjects, (project) => !project.added);
    const ownFolderPaths = new Set(Array.map(ownFolderProjects, (project) => project.path));
    const newProjectPaths = Array.filter(
      pickedFolderPaths,
      (pickedFolderPath) => !ownFolderPaths.has(pickedFolderPath)
    );

    yield* addProjectPaths(newProjectPaths);
    yield* showFirstNewProject(newProjectPaths);
  },
  Effect.catchTag("FolderPickCancelledError", () => Effect.void),
  Effect.catch(showRepositoryError)
);

// Its sessions stay saved and their open tabs keep running; adding the project again lists them again. Its folder leaves
// the workspace first, since a workspace folder that is not added is listed as one of the window's own.
export const removeProject = Effect.fn("ProjectService.removeProject")(
  function* (project: ListedProjectValueObject) {
    yield* IWorkspaceInfraService.use((workspaceInfraService) =>
      workspaceInfraService.removeProjectFolder(project.path)
    );
    const storedProjects = yield* findEntities(IProjectRepository, {path: project.path});
    yield* Effect.forEach(storedProjects, (storedProject) =>
      updateEntity(IProjectRepository, storedProject.id, {added: false})
    );
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void),
  Effect.catch(showRepositoryError)
);

const openPickedProjectTerminal = Effect.fn("ProjectService.openPickedProjectTerminal")(function* () {
  const pickedProject = yield* pickProject(PROJECT_LABELS.PICK_FOR_TERMINAL);

  yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.openProjectTerminal(pickedProject));
});

// A shell in any of the window's projects, shown in the workspace or not; asks which when there is more than one.
export const newProjectTerminal = Effect.fn("ProjectService.newProjectTerminal")(
  function* () {
    yield* openPickedProjectTerminal();
  },
  Effect.catchTag("ProjectPickCancelledError", () => Effect.void),
  Effect.catch((terminalError) =>
    showErrorInBackground(
      Match.valueTags(terminalError, {
        NoProjectError: () => TERMINAL_MESSAGES.PROJECT_REQUIRED,
        TerminalLaunchFailedError: () => TERMINAL_MESSAGES.LAUNCH_FAILED
      })
    )
  )
);
