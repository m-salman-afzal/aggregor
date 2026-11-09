import {IGitInfraService} from "@interfaces/git.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {addProjectPaths, listProjects} from "@services/project.service.ts";
import {findSession, openSession} from "@services/session.service.ts";
import {Array, Effect, Result, Stream, SubscriptionRef} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// The window's own folders about to make way for the shown project become added projects, so they stay listed. Added
// projects are left alone: adding one again would move it to the end of the list.
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

// The session's project becomes the workspace's only project folder. A session whose project is no longer listed
// changes nothing.
const showSessionProject = Effect.fn("WorkspaceService.showSessionProject")(
  function* (sessionId: EntityIdValueObject) {
    const session = yield* findSession(sessionId);
    const projectListItems = yield* listProjects();
    if (!Array.some(projectListItems, (projectListItem) => projectListItem.path === session.projectPath)) return;

    yield* keepWorkspaceFoldersListed(projectListItems, session.projectPath);
    // Opened before the swap closes the old one, Source Control goes straight from one repository to the other instead
    // of showing that the workspace has none.
    yield* IGitInfraService.use((gitInfraService) => gitInfraService.openInSourceControl(session.projectPath));
    yield* IWorkspaceInfraService.use((workspaceInfraService) =>
      workspaceInfraService.showOnlyProjectFolder(session.projectPath, session.id)
    );
  },
  // A tab left running by a removed session has no project to show.
  Effect.catchTag("SessionNotFoundError", () => Effect.void),
  // Folders that could not be kept listed stay in the workspace; no command started this, so it is logged.
  Effect.catch((databaseError) => Effect.logWarning("Could not keep the workspace's folders listed", databaseError))
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

// Opening Aggregor's workspace reloaded the window, which closed the session's tab; the window opens it again. Nothing
// shows a failure, since no command started this, so it is logged.
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
