import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {listProjects, showProjectRepositoryError} from "@services/project.service.ts";
import {findSession} from "@services/session.service.ts";
import {Array, Effect, Result, Stream, SubscriptionRef} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";

// The workspace folders about to make way for the shown project become added projects, so they stay listed.
const keepWorkspaceFoldersListed = Effect.fn("WorkspaceService.keepWorkspaceFoldersListed")(function* (
  shownProjectPath: ProjectPathValueObject
) {
  const {modifyAddedProjectPaths} = yield* IProjectRepository;
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use(
    (workspaceInfraService) => workspaceInfraService.listWorkspaceFolderProjects
  );
  const leavingFolderPaths = Array.filter(
    Array.map(workspaceFolderProjects, (project) => project.path),
    (folderPath) => folderPath !== shownProjectPath
  );
  if (leavingFolderPaths.length === 0) return;

  yield* modifyAddedProjectPaths((storedAddedProjectPaths) => [
    ...new Set([...storedAddedProjectPaths, ...leavingFolderPaths])
  ]);
});

// The session's project becomes the workspace's only project folder. A session whose project is no longer listed
// changes nothing.
const showSessionProject = Effect.fn("WorkspaceService.showSessionProject")(
  function* (sessionId: SessionIdValueObject) {
    const session = yield* findSession(sessionId);
    const projects = yield* listProjects();
    if (!Array.some(projects, (project) => project.path === session.projectPath)) return;

    yield* keepWorkspaceFoldersListed(session.projectPath);
    yield* IWorkspaceInfraService.use((workspaceInfraService) =>
      workspaceInfraService.showOnlyProjectFolder(session.projectPath)
    );
  },
  // A tab left running by a removed session has no project to show.
  Effect.catchTag("SessionNotFoundError", () => Effect.void),
  // Folders that could not be kept listed stay in the workspace.
  Effect.catchTags({
    ProjectsCorruptError: showProjectRepositoryError,
    ProjectsSaveFailedError: showProjectRepositoryError
  })
);

// Like VS Code's Agents window, the workspace follows the session in view: its project is the one project folder, so
// Explorer, search, file watching and Source Control cover it alone. With no session in view the project stays, so
// opening one of its files keeps it.
export const startShownProjectSync = Effect.fn("WorkspaceService.startShownProjectSync")(function* () {
  const {viewedSessionId} = yield* ITerminalInfraService;

  yield* Effect.forkScoped(
    Stream.runForEach(SubscriptionRef.changes(viewedSessionId), (viewedSessionIdResult) =>
      Result.match(viewedSessionIdResult, {onFailure: () => Effect.void, onSuccess: showSessionProject})
    )
  );
});
