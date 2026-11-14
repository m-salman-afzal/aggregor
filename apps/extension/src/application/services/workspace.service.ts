import {IGitInfraService} from "@interfaces/git.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {addProjectPaths, listProjects} from "@services/project.service.ts";
import {findSession, openSession} from "@services/session.service.ts";
import {Array, Effect, Result, Stream, SubscriptionRef} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// Added projects are left alone: adding one again would move it to the end of the list.
const keepWorkspaceFoldersListed = Effect.fn("WorkspaceService.keepWorkspaceFoldersListed")(function* (
  projectListItems: readonly ProjectListItemDto[],
  shownProjectPath: ProjectPathValueObject
) {
  const leavingOwnFolderProjects = Array.filter(
    projectListItems,
    (projectListItem) => !projectListItem.isAdded && projectListItem.path !== shownProjectPath
  );
  if (leavingOwnFolderProjects.length === 0) return;

  yield* addProjectPaths(
    Array.map(leavingOwnFolderProjects, (leavingOwnFolderProject) => leavingOwnFolderProject.path)
  );
});

const showSessionProject = Effect.fn("WorkspaceService.showSessionProject")(
  function* (sessionId: EntityIdValueObject) {
    const session = yield* findSession(sessionId);
    const projectListItems = yield* listProjects();
    if (!Array.some(projectListItems, (projectListItem) => projectListItem.path === session.projectPath)) return;

    yield* keepWorkspaceFoldersListed(projectListItems, session.workingFolderPath);
    // Opened before the swap closes the old one, so Source Control never shows a workspace with no repository.
    yield* IGitInfraService.use((gitInfraService) => gitInfraService.openInSourceControl(session.workingFolderPath));
    yield* IWorkspaceInfraService.use((workspaceInfraService) =>
      workspaceInfraService.showOnlyProjectFolder(session.workingFolderPath, session.id)
    );
  },
  // A tab left running by a removed session has no project to show.
  Effect.catchTag("SessionNotFoundError", () => Effect.void),
  // No command started this, so a failure is logged.
  Effect.catch((databaseError) => Effect.logWarning("Could not keep the workspace's folders listed", databaseError))
);

// Like VS Code's Agents window, the workspace follows the session in view; with none in view the project stays.
export const startShownProjectSync = Effect.fn("WorkspaceService.startShownProjectSync")(function* () {
  const terminalInfraService = yield* ITerminalInfraService;

  yield* Effect.forkScoped(
    Stream.runForEach(SubscriptionRef.changes(terminalInfraService.viewedSessionId), (viewedSessionIdResult) =>
      Result.match(viewedSessionIdResult, {onFailure: () => Effect.void, onSuccess: showSessionProject})
    )
  );
});

// Opening Aggregor's workspace reloaded the window, which closed the session's tab.
const reopenSessionAfterReload = Effect.fn("WorkspaceService.reopenSessionAfterReload")(
  function* () {
    const sessionId = yield* IWorkspaceInfraService.use(
      (workspaceInfraService) => workspaceInfraService.takeSessionToReopen
    );

    yield* openSession({sessionId});
  },
  Effect.catchTag("NoSessionToReopenError", () => Effect.void),
  Effect.catch((openError) => Effect.logWarning("Could not reopen the session after the reload", openError))
);

// In the background, so the window starts without waiting for the session's tab.
export const startSessionReopenAfterReload = Effect.fn("WorkspaceService.startSessionReopenAfterReload")(function* () {
  yield* Effect.forkScoped(reopenSessionAfterReload());
});
