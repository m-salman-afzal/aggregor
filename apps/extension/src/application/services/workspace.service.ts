import {IGitInfraService} from "@interfaces/git.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {ProjectService} from "@services/project.service.ts";
import {SessionService} from "@services/session.service.ts";
import {Array, Context, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class WorkspaceService extends Context.Service<WorkspaceService>()(
  "aggregor-app/application/services/workspace.service/WorkspaceService",
  {
    make: Effect.fn("WorkspaceService.make")(function* () {
      const gitInfraService = yield* IGitInfraService;
      const terminalInfraService = yield* ITerminalInfraService;
      const workspaceInfraService = yield* IWorkspaceInfraService;
      const projectService = yield* ProjectService;
      const sessionService = yield* SessionService;

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

        yield* projectService.addProjectPaths(
          Array.map(leavingOwnFolderProjects, (leavingOwnFolderProject) => leavingOwnFolderProject.path)
        );
      });

      const showSessionProject = Effect.fn("WorkspaceService.showSessionProject")(
        function* (sessionId: EntityIdValueObject) {
          const session = yield* sessionService.findSession(sessionId);
          const projectListItems = yield* projectService.listProjects;
          if (!Array.some(projectListItems, (projectListItem) => projectListItem.path === session.projectPath)) return;

          yield* keepWorkspaceFoldersListed(projectListItems, session.workingFolderPath);
          // Opened before the swap closes the old one, so Source Control never shows a workspace with no repository.
          yield* gitInfraService.openInSourceControl(session.workingFolderPath);
          yield* workspaceInfraService.showOnlyProjectFolder(session.workingFolderPath, session.id);
        },
        Effect.catchTag("SessionNotFoundError", () => Effect.void),
        Effect.catch((databaseError) =>
          Effect.logWarning("Could not keep the workspace's folders listed", databaseError)
        )
      );

      const startShownProjectSync = Effect.fn("WorkspaceService.startShownProjectSync")(function* () {
        yield* Effect.forkScoped(
          // A switch takes about a second, so only the last session viewed during one is switched to next.
          SubscriptionRef.changes(terminalInfraService.viewedSessionId).pipe(
            Stream.buffer({capacity: 1, strategy: "sliding"}),
            Stream.runForEach((viewedSessionIdResult) =>
              Result.match(viewedSessionIdResult, {onFailure: () => Effect.void, onSuccess: showSessionProject})
            )
          )
        );
      });

      const reopenSessionAfterReload = Effect.fn("WorkspaceService.reopenSessionAfterReload")(
        function* () {
          const sessionId = yield* workspaceInfraService.takeSessionToReopen;

          yield* sessionService.openSession({sessionId});
        },
        Effect.catchTag("NoSessionToReopenError", () => Effect.void),
        Effect.catch((openError) => Effect.logWarning("Could not reopen the session after the reload", openError))
      );

      const startSessionReopenAfterReload = Effect.fn("WorkspaceService.startSessionReopenAfterReload")(function* () {
        yield* Effect.forkScoped(reopenSessionAfterReload());
      });

      return {
        startSessionReopenAfterReload: startSessionReopenAfterReload(),
        startShownProjectSync: startShownProjectSync()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([ProjectService.layer, SessionService.layer])
  );
}
