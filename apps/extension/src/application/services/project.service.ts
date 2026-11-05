import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {ProjectEntity} from "@entities/project/project.entity.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {IPromptInfraService} from "@interfaces/prompt.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {PROJECT_LABELS, PROJECT_MESSAGES, TERMINAL_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Array, Effect, Match, Result, Schema, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectsCorruptError, ProjectsSaveFailedError} from "@entities/project/project.repository.interface.ts";

export class NoProjectError extends Schema.TaggedError<NoProjectError, {readonly brand: unique symbol}>()(
  "NoProjectError",
  {}
) {}

export const showProjectRepositoryError = Effect.fn("ProjectService.showProjectRepositoryError")(function* (
  projectRepositoryError: ProjectsCorruptError | ProjectsSaveFailedError
) {
  yield* showErrorInBackground(
    Match.valueTags(projectRepositoryError, {
      ProjectsCorruptError: () => PROJECT_MESSAGES.UNREADABLE,
      ProjectsSaveFailedError: () => PROJECT_MESSAGES.SAVE_FAILED
    })
  );
});

// This window's projects: its own workspace folders, then the added projects. The added project shown as a workspace
// folder stays an added project.
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
    ProjectEntity.make({added: true, name: path.basename(addedProjectPath), path: addedProjectPath})
  );

  return [...ownFolderProjects, ...addedProjects];
});

// Asks only when the window has more than one project.
export const pickProject = Effect.fn("ProjectService.pickProject")(function* (placeHolder: string) {
  const projects = yield* listProjects();
  if (projects.length > 1)
    return yield* IPromptInfraService.use((promptInfraService) =>
      promptInfraService.pickProject(projects, placeHolder)
    );

  return yield* Effect.fromResult(Result.fromNullishOr(projects[0], () => NoProjectError.make()));
});

// ponytail: any folder counts as a project, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addProject = Effect.fn("ProjectService.addProject")(
  function* () {
    const {modifyAddedProjectPaths} = yield* IProjectRepository;
    const pickedFolderPaths = yield* IPromptInfraService.use(
      (promptInfraService) => promptInfraService.pickProjectFolderPaths
    );
    // One of the window's own folders is listed already.
    const listedProjects = yield* listProjects();
    const ownFolderProjects = Array.filter(listedProjects, (project) => !project.added);
    const ownFolderPaths = new Set(Array.map(ownFolderProjects, (project) => project.path));
    const newProjectPaths = Array.filter(
      pickedFolderPaths,
      (pickedFolderPath) => !ownFolderPaths.has(pickedFolderPath)
    );

    yield* modifyAddedProjectPaths((storedAddedProjectPaths) => [
      ...new Set([...storedAddedProjectPaths, ...newProjectPaths])
    ]);
  },
  Effect.catchTag("FolderPickCancelledError", () => Effect.void),
  Effect.catch(showProjectRepositoryError)
);

// Its sessions stay saved and their open tabs keep running; adding the project again lists them again. Its folder leaves
// the workspace first, since a workspace folder that is not added is listed as one of the window's own.
export const removeProject = Effect.fn("ProjectService.removeProject")(function* (project: ProjectEntity) {
  const {modifyAddedProjectPaths} = yield* IProjectRepository;
  yield* IWorkspaceInfraService.use((workspaceInfraService) => workspaceInfraService.removeProjectFolder(project.path));
  yield* modifyAddedProjectPaths((storedAddedProjectPaths) =>
    Array.filter(storedAddedProjectPaths, (addedProjectPath) => addedProjectPath !== project.path)
  );
}, Effect.catch(showProjectRepositoryError));

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
