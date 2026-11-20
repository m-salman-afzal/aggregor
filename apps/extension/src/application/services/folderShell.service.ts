import {ProfileTerminalDtoSchema} from "@dtos/folderShell.dto.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {FOLDER_SHELL_STATUS_LABEL} from "@pkg/constants/src/terminal.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {BaseService} from "@services/base.service.ts";
import {ProjectService} from "@services/project.service.ts";
import {SessionService} from "@services/session.service.ts";
import {Context, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {OpenProjectTerminalRequestDto, OpenSessionFolderTerminalRequestDto} from "@dtos/folderShell.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {FolderShellRequest} from "@interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export class FolderShellServiceErrors extends TaggedErrors({
  NoShownFolderError: {}
}) {}

export class FolderShellService extends Context.Service<FolderShellService>()(
  "aggregor-app/application/services/folderShell.service/FolderShellService",
  {
    make: Effect.fn("FolderShellService.make")(function* () {
      const sessionRepository = yield* ISessionRepository;
      const terminalInfraService = yield* ITerminalInfraService;
      const tmuxInfraService = yield* ITmuxInfraService;
      const workspaceInfraService = yield* IWorkspaceInfraService;
      const path = yield* Path;
      const projectService = yield* ProjectService;
      const sessionService = yield* SessionService;
      const baseService = yield* BaseService;
      const sessionBaseService = yield* baseService.makeFor(sessionRepository);

      // The extension can restart under the open terminal, which shows the shell tmux last attached it to.
      const syncFolderShellTerminalWithTmux = Effect.fn("FolderShellService.syncFolderShellTerminalWithTmux")(
        function* () {
          const terminalProcessId = yield* terminalInfraService.findFolderShellTerminalProcessId;
          const shownFolderPath = yield* tmuxInfraService.readFolderShellPathShownInTerminal(terminalProcessId);

          yield* terminalInfraService.assignShownFolderShellPath(shownFolderPath);
        },
        Effect.catchTag(["FolderShellNotShownError", "NoFolderShellTerminalOpenError"], () => Effect.void)
      );

      // tmux attaches the open terminal to the folder's shell, so VS Code sees no change and its panel stays as it is.
      const showFolderShellInOpenTerminal = Effect.fn("FolderShellService.showFolderShellInOpenTerminal")(
        function* (folderShellRequest: FolderShellRequest) {
          const terminalProcessId = yield* terminalInfraService.findFolderShellTerminalProcessId;
          yield* tmuxInfraService.showFolderShellInTerminal(terminalProcessId, folderShellRequest);
          yield* syncFolderShellTerminalWithTmux();
        },
        Effect.catchTag("NoFolderShellTerminalOpenError", () => Effect.void)
      );

      const openFolderShell = Effect.fn("FolderShellService.openFolderShell")(function* (
        folderShellRequest: FolderShellRequest
      ) {
        yield* showFolderShellInOpenTerminal(folderShellRequest);
        const terminalCommand = yield* tmuxInfraService.prepareFolderShellTerminalCommand(folderShellRequest);

        yield* terminalInfraService.openFolderShellTerminal({
          folderPath: folderShellRequest.folderPath,
          terminalCommand
        });
      });

      const openProjectTerminal = Effect.fn("FolderShellService.openProjectTerminal")(
        function* (request: OpenProjectTerminalRequestDto) {
          const chosenProject = yield* projectService.findProjectListItem(request.projectPath);

          yield* openFolderShell({folderPath: chosenProject.path, statusLabel: chosenProject.name});
        },
        Effect.catchTag("ProjectNotListedError", () => Effect.void)
      );

      const labelSessionFolderShell = Effect.fn("FolderShellService.labelSessionFolderShell")(function* (
        session: SessionEntity,
        projectName: string
      ) {
        return session.worktreePath === undefined
          ? projectName
          : FOLDER_SHELL_STATUS_LABEL.WORKTREE(projectName, path.basename(session.worktreePath));
      });

      const prepareSessionFolderShellRequest = Effect.fn("FolderShellService.prepareSessionFolderShellRequest")(
        function* (session: SessionEntity) {
          const sessionProject = yield* projectService.findProjectListItem(session.projectPath);
          const folderShellRequest: FolderShellRequest = {
            folderPath: session.workingFolderPath,
            statusLabel: yield* labelSessionFolderShell(session, sessionProject.name)
          };

          return folderShellRequest;
        }
      );

      const openSessionFolderTerminal = Effect.fn("FolderShellService.openSessionFolderTerminal")(
        function* (request: OpenSessionFolderTerminalRequestDto) {
          const session = yield* sessionService.findSession(request.sessionId);
          const folderShellRequest = yield* prepareSessionFolderShellRequest(session);

          yield* openFolderShell(folderShellRequest);
        },
        Effect.catchTag("ProjectNotListedError", () => Effect.void)
      );

      const showViewedSessionFolderShell = Effect.fn("FolderShellService.showViewedSessionFolderShell")(
        function* (viewedSessionId: EntityIdValueObject) {
          const viewedSession = yield* sessionService.findSession(viewedSessionId);
          const folderShellRequest = yield* prepareSessionFolderShellRequest(viewedSession);

          yield* showFolderShellInOpenTerminal(folderShellRequest);
        },
        Effect.catchTags({ProjectNotListedError: () => Effect.void, SessionNotFoundError: () => Effect.void}),
        Effect.catch((followError) =>
          Effect.logWarning("Could not show the viewed session's folder shell", followError)
        )
      );

      const startFolderShellFollow = Effect.fn("FolderShellService.startFolderShellFollow")(function* () {
        yield* Effect.forkScoped(
          SubscriptionRef.changes(terminalInfraService.viewedSessionId).pipe(
            Stream.buffer({capacity: 1, strategy: "sliding"}),
            Stream.runForEach((viewedSessionIdResult) =>
              Result.match(viewedSessionIdResult, {
                onFailure: () => Effect.void,
                onSuccess: showViewedSessionFolderShell
              })
            )
          )
        );
      });

      const startFolderShellEndOnTerminalClose = Effect.fn("FolderShellService.startFolderShellEndOnTerminalClose")(
        function* () {
          yield* Effect.forkScoped(
            Stream.runForEach(terminalInfraService.folderShellPathsClosedByUser, (closedFolderShellPath) =>
              tmuxInfraService.endFolderShell(closedFolderShellPath)
            )
          );
        }
      );

      const prepareShownFolderShellRequest = Effect.fn("FolderShellService.prepareShownFolderShellRequest")(
        function* () {
          const workspaceFolderProjects = yield* workspaceInfraService.listWorkspaceFolderProjects;
          const [shownFolder] = workspaceFolderProjects;
          if (shownFolder === undefined) return yield* FolderShellServiceErrors.NoShownFolderError.make();
          const [worktreeSession] = yield* sessionBaseService.findEntities({worktreePath: shownFolder.path});
          if (worktreeSession !== undefined) return yield* prepareSessionFolderShellRequest(worktreeSession);
          const shownProject = yield* projectService.findProjectListItem(shownFolder.path);
          const folderShellRequest: FolderShellRequest = {
            folderPath: shownProject.path,
            statusLabel: shownProject.name
          };

          return folderShellRequest;
        }
      );

      const prepareProfileFolderShellRequest = Effect.fn("FolderShellService.prepareProfileFolderShellRequest")(
        function* () {
          const viewedSessionId = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);
          if (Result.isFailure(viewedSessionId)) return yield* prepareShownFolderShellRequest();
          const viewedSession = yield* sessionService.findSession(viewedSessionId.success);

          return yield* prepareSessionFolderShellRequest(viewedSession);
        }
      );

      // VS Code opens its default terminal when the panel shows none and on every +: the first is the Aggregor terminal.
      const prepareProfileTerminal = Effect.fn("FolderShellService.prepareProfileTerminal")(function* () {
        const openFolderShellTerminal = yield* Effect.result(terminalInfraService.findFolderShellTerminalProcessId);
        if (Result.isSuccess(openFolderShellTerminal)) return ProfileTerminalDtoSchema.make({});
        const folderShellRequest = yield* prepareProfileFolderShellRequest();
        const terminalCommand = yield* tmuxInfraService.prepareFolderShellTerminalCommand(folderShellRequest);
        const folderShellTerminal = yield* terminalInfraService.prepareFolderShellTerminalOptions(terminalCommand);
        yield* terminalInfraService.assignShownFolderShellPath(folderShellRequest.folderPath);

        return ProfileTerminalDtoSchema.make({folderShellTerminal});
      });

      return {
        openProjectTerminal,
        openSessionFolderTerminal,
        prepareProfileTerminal: prepareProfileTerminal(),
        prepareSessionFolderShellRequest,
        startFolderShellEndOnTerminalClose: startFolderShellEndOnTerminalClose(),
        startFolderShellFollow: startFolderShellFollow(),
        syncFolderShellTerminalWithTmux: syncFolderShellTerminalWithTmux()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([BaseService.layer, ProjectService.layer, SessionService.layer])
  );
}
