import {PromptClient} from "@/application/clients/prompt.client.ts";
import {WorkspaceClient} from "@/application/clients/workspace.client.ts";
import {NoProject} from "@/application/errors/project.error.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {Project} from "@/domain/entities/project/project.entity.ts";
import {ProjectRepository} from "@/domain/entities/project/project.repository.ts";
import {PROJECT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectsCorrupt, ProjectsSaveFailed} from "@/domain/errors/project.error.ts";

const showProjectRepositoryError = Effect.fn("showProjectRepositoryError")(function* (
  projectRepositoryError: ProjectsCorrupt | ProjectsSaveFailed
) {
  yield* showErrorInBackground(
    Match.valueTags(projectRepositoryError, {
      ProjectsCorrupt: () => PROJECT_MESSAGES.UNREADABLE,
      ProjectsSaveFailed: () => PROJECT_MESSAGES.SAVE_FAILED
    })
  );
});

// This window's projects: its workspace folders, then the added paths that are not also one of them.
export const listProjects = Effect.fn("listProjects")(function* () {
  const {addedProjectPaths} = yield* ProjectRepository;
  const path = yield* Path;
  const workspaceFolderProjects = yield* WorkspaceClient.use((workspaceClient) =>
    workspaceClient.listWorkspaceFolderProjects()
  );
  const workspaceFolderPaths = new Set(workspaceFolderProjects.map((project) => project.path));
  const addedProjects = (yield* SubscriptionRef.get(addedProjectPaths))
    .filter((addedProjectPath) => !workspaceFolderPaths.has(addedProjectPath))
    .map(
      (addedProjectPath) => new Project({added: true, name: path.basename(addedProjectPath), path: addedProjectPath})
    );

  return [...workspaceFolderProjects, ...addedProjects];
});

// Asks only when the window has more than one project.
export const pickProject = Effect.fn("pickProject")(function* () {
  const projects = yield* listProjects();
  if (projects.length > 1) return yield* PromptClient.use((promptClient) => promptClient.pickProject(projects));

  return yield* Effect.fromResult(Result.fromNullishOr(projects[0], () => new NoProject()));
});

// ponytail: any folder counts as a project, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addProject = Effect.fn("addProject")(
  function* () {
    const {modifyAddedProjectPaths} = yield* ProjectRepository;
    const pickedFolderPaths = yield* PromptClient.use((promptClient) => promptClient.pickProjectFolderPaths());

    yield* modifyAddedProjectPaths((storedAddedProjectPaths) => [
      ...new Set([...storedAddedProjectPaths, ...pickedFolderPaths])
    ]);
  },
  Effect.catchTag("FolderPickCancelled", () => Effect.void),
  Effect.catch(showProjectRepositoryError)
);

// Its sessions stay saved and their open tabs keep running; adding the project again lists them again.
export const removeProject = Effect.fn("removeProject")(function* (project: Project) {
  const {modifyAddedProjectPaths} = yield* ProjectRepository;
  yield* modifyAddedProjectPaths((storedAddedProjectPaths) =>
    storedAddedProjectPaths.filter((addedProjectPath) => addedProjectPath !== project.path)
  );
}, Effect.catch(showProjectRepositoryError));
