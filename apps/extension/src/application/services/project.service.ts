import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {ProjectEntity} from "@entities/project/project.entity.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {IPromptInfraService} from "@interfaces/prompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {PROJECT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Array, Effect, Match, Result, Schema, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectsCorruptError, ProjectsSaveFailedError} from "@entities/project/project.repository.interface.ts";

export class NoProjectError extends Schema.TaggedError<NoProjectError, {readonly brand: unique symbol}>()(
  "NoProjectError",
  {}
) {}

const showProjectRepositoryError = Effect.fn("ProjectService.showProjectRepositoryError")(function* (
  projectRepositoryError: ProjectsCorruptError | ProjectsSaveFailedError
) {
  yield* showErrorInBackground(
    Match.valueTags(projectRepositoryError, {
      ProjectsCorruptError: () => PROJECT_MESSAGES.UNREADABLE,
      ProjectsSaveFailedError: () => PROJECT_MESSAGES.SAVE_FAILED
    })
  );
});

// This window's projects: its workspace folders, then the added paths that are not also one of them.
export const listProjects = Effect.fn("ProjectService.listProjects")(function* () {
  const {addedProjectPaths} = yield* IProjectRepository;
  const path = yield* Path;
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use(
    (workspaceInfraService) => workspaceInfraService.listWorkspaceFolderProjects
  );
  const workspaceFolderPaths = new Set(Array.map(workspaceFolderProjects, (project) => project.path));
  const currentAddedProjectPaths = yield* SubscriptionRef.get(addedProjectPaths);
  const addedProjects = Array.map(
    Array.filter(currentAddedProjectPaths, (addedProjectPath) => !workspaceFolderPaths.has(addedProjectPath)),
    (addedProjectPath) =>
      ProjectEntity.make({added: true, name: path.basename(addedProjectPath), path: addedProjectPath})
  );

  return [...workspaceFolderProjects, ...addedProjects];
});

// Asks only when the window has more than one project.
export const pickProject = Effect.fn("ProjectService.pickProject")(function* () {
  const projects = yield* listProjects();
  if (projects.length > 1)
    return yield* IPromptInfraService.use((promptInfraService) => promptInfraService.pickProject(projects));

  return yield* Effect.fromResult(Result.fromNullishOr(projects[0], () => NoProjectError.make()));
});

// ponytail: any folder counts as a project, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addProject = Effect.fn("ProjectService.addProject")(
  function* () {
    const {modifyAddedProjectPaths} = yield* IProjectRepository;
    const pickedFolderPaths = yield* IPromptInfraService.use(
      (promptInfraService) => promptInfraService.pickProjectFolderPaths
    );

    yield* modifyAddedProjectPaths((storedAddedProjectPaths) => [
      ...new Set([...storedAddedProjectPaths, ...pickedFolderPaths])
    ]);
  },
  Effect.catchTag("FolderPickCancelledError", () => Effect.void),
  Effect.catch(showProjectRepositoryError)
);

// Its sessions stay saved and their open tabs keep running; adding the project again lists them again.
export const removeProject = Effect.fn("ProjectService.removeProject")(function* (project: ProjectEntity) {
  const {modifyAddedProjectPaths} = yield* IProjectRepository;
  yield* modifyAddedProjectPaths((storedAddedProjectPaths) =>
    Array.filter(storedAddedProjectPaths, (addedProjectPath) => addedProjectPath !== project.path)
  );
}, Effect.catch(showProjectRepositoryError));
