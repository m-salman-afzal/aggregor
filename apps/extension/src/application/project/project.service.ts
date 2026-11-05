import {NoProjectError} from "@/application/errors/project.service.error.ts";
import {IPromptInfraService} from "@/application/interfaces/prompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@/application/interfaces/workspace.infraService.interface.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {ProjectEntity} from "@/domain/entities/project/project.entity.ts";
import {IProjectRepository} from "@/domain/entities/project/project.repository.interface.ts";
import {PROJECT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectsCorruptError, ProjectsSaveFailedError} from "@/domain/errors/project.repository.error.ts";

const showProjectRepositoryError = Effect.fn("showProjectRepositoryError")(function* (
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
export const listProjects = Effect.fn("listProjects")(function* () {
  const {addedProjectPaths} = yield* IProjectRepository;
  const path = yield* Path;
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use((workspaceInfraService) =>
    workspaceInfraService.listWorkspaceFolderProjects()
  );
  const workspaceFolderPaths = new Set(workspaceFolderProjects.map((project) => project.path));
  const addedProjects = (yield* SubscriptionRef.get(addedProjectPaths))
    .filter((addedProjectPath) => !workspaceFolderPaths.has(addedProjectPath))
    .map(
      (addedProjectPath) =>
        new ProjectEntity({added: true, name: path.basename(addedProjectPath), path: addedProjectPath})
    );

  return [...workspaceFolderProjects, ...addedProjects];
});

// Asks only when the window has more than one project.
export const pickProject = Effect.fn("pickProject")(function* () {
  const projects = yield* listProjects();
  if (projects.length > 1)
    return yield* IPromptInfraService.use((promptInfraService) => promptInfraService.pickProject(projects));

  return yield* Effect.fromResult(Result.fromNullishOr(projects[0], () => new NoProjectError()));
});

// ponytail: any folder counts as a project, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addProject = Effect.fn("addProject")(
  function* () {
    const {modifyAddedProjectPaths} = yield* IProjectRepository;
    const pickedFolderPaths = yield* IPromptInfraService.use((promptInfraService) =>
      promptInfraService.pickProjectFolderPaths()
    );

    yield* modifyAddedProjectPaths((storedAddedProjectPaths) => [
      ...new Set([...storedAddedProjectPaths, ...pickedFolderPaths])
    ]);
  },
  Effect.catchTag("FolderPickCancelledError", () => Effect.void),
  Effect.catch(showProjectRepositoryError)
);

// Its sessions stay saved and their open tabs keep running; adding the project again lists them again.
export const removeProject = Effect.fn("removeProject")(function* (project: ProjectEntity) {
  const {modifyAddedProjectPaths} = yield* IProjectRepository;
  yield* modifyAddedProjectPaths((storedAddedProjectPaths) =>
    storedAddedProjectPaths.filter((addedProjectPath) => addedProjectPath !== project.path)
  );
}, Effect.catch(showProjectRepositoryError));
