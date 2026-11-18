import {ProfileTerminalDtoSchema} from "@dtos/folderShell.dto.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {FOLDER_SHELL_STATUS_LABEL} from "@pkg/constants/src/terminal.constant.ts";
import {findEntities} from "@services/base.service.ts";
import {findProjectListItem} from "@services/project.service.ts";
import {findSession} from "@services/session.service.ts";
import {Effect, Result, Schema, Stream, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {OpenProjectTerminalRequestDto, OpenSessionFolderTerminalRequestDto} from "@dtos/folderShell.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {FolderShellRequest} from "@interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export class NoShownFolderError extends Schema.TaggedError<NoShownFolderError, {readonly brand: unique symbol}>()(
  "NoShownFolderError",
  {}
) {}

// The extension can restart under the open terminal, which shows the shell tmux last attached it to.
export const syncFolderShellTerminalWithTmux = Effect.fn("FolderShellService.syncFolderShellTerminalWithTmux")(
  function* () {
    const terminalInfraService = yield* ITerminalInfraService;
    const terminalProcessId = yield* terminalInfraService.findFolderShellTerminalProcessId;
    const shownFolderPath = yield* ITmuxInfraService.use((tmuxInfraService) =>
      tmuxInfraService.readFolderShellPathShownInTerminal(terminalProcessId)
    );

    yield* terminalInfraService.assignShownFolderShellPath(shownFolderPath);
  },
  Effect.catchTag(["FolderShellNotShownError", "NoFolderShellTerminalOpenError"], () => Effect.void)
);

// tmux attaches the open terminal to the folder's shell, so VS Code sees no change and its panel stays as it is.
const showFolderShellInOpenTerminal = Effect.fn("FolderShellService.showFolderShellInOpenTerminal")(
  function* (folderShellRequest: FolderShellRequest) {
    const terminalProcessId = yield* ITerminalInfraService.use(
      (terminalInfraService) => terminalInfraService.findFolderShellTerminalProcessId
    );
    yield* ITmuxInfraService.use((tmuxInfraService) =>
      tmuxInfraService.showFolderShellInTerminal(terminalProcessId, folderShellRequest)
    );
    yield* syncFolderShellTerminalWithTmux();
  },
  Effect.catchTag("NoFolderShellTerminalOpenError", () => Effect.void)
);

// With no terminal open, the one that opens starts on the folder's shell.
const openFolderShell = Effect.fn("FolderShellService.openFolderShell")(function* (
  folderShellRequest: FolderShellRequest
) {
  yield* showFolderShellInOpenTerminal(folderShellRequest);
  const terminalCommand = yield* ITmuxInfraService.use((tmuxInfraService) =>
    tmuxInfraService.prepareFolderShellTerminalCommand(folderShellRequest)
  );

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openFolderShellTerminal({folderPath: folderShellRequest.folderPath, terminalCommand})
  );
});

// A project no longer listed opens nothing.
export const openProjectTerminal = Effect.fn("FolderShellService.openProjectTerminal")(
  function* (request: OpenProjectTerminalRequestDto) {
    const chosenProject = yield* findProjectListItem(request.projectPath);

    yield* openFolderShell({folderPath: chosenProject.path, statusLabel: chosenProject.name});
  },
  Effect.catchTag("ProjectNotListedError", () => Effect.void)
);

const labelSessionFolderShell = Effect.fn("FolderShellService.labelSessionFolderShell")(function* (
  session: SessionEntity,
  projectName: string
) {
  const path = yield* Path;

  return session.worktreePath === undefined
    ? projectName
    : FOLDER_SHELL_STATUS_LABEL.WORKTREE(projectName, path.basename(session.worktreePath));
});

// A root session shares its project's shell; sessions in one worktree share the worktree's.
const prepareSessionFolderShellRequest = Effect.fn("FolderShellService.prepareSessionFolderShellRequest")(function* (
  session: SessionEntity
) {
  const sessionProject = yield* findProjectListItem(session.projectPath);
  const folderShellRequest: FolderShellRequest = {
    folderPath: session.workingFolderPath,
    statusLabel: yield* labelSessionFolderShell(session, sessionProject.name)
  };

  return folderShellRequest;
});

export const openSessionFolderTerminal = Effect.fn("FolderShellService.openSessionFolderTerminal")(
  function* (request: OpenSessionFolderTerminalRequestDto) {
    const session = yield* findSession(request.sessionId);
    const folderShellRequest = yield* prepareSessionFolderShellRequest(session);

    yield* openFolderShell(folderShellRequest);
  },
  Effect.catchTag("ProjectNotListedError", () => Effect.void)
);

// No command started this, so a failure is logged; with no Aggregor terminal open nothing moves.
const showViewedSessionFolderShell = Effect.fn("FolderShellService.showViewedSessionFolderShell")(
  function* (viewedSessionId: EntityIdValueObject) {
    const viewedSession = yield* findSession(viewedSessionId);
    const folderShellRequest = yield* prepareSessionFolderShellRequest(viewedSession);

    yield* showFolderShellInOpenTerminal(folderShellRequest);
  },
  Effect.catchTags({ProjectNotListedError: () => Effect.void, SessionNotFoundError: () => Effect.void}),
  Effect.catch((followError) => Effect.logWarning("Could not show the viewed session's folder shell", followError))
);

// tmux switches the terminal behind VS Code's back, so the Terminal panel stays open or hidden as it was.
export const startFolderShellFollow = Effect.fn("FolderShellService.startFolderShellFollow")(function* () {
  const terminalInfraService = yield* ITerminalInfraService;

  yield* Effect.forkScoped(
    SubscriptionRef.changes(terminalInfraService.viewedSessionId).pipe(
      Stream.buffer({capacity: 1, strategy: "sliding"}),
      Stream.runForEach((viewedSessionIdResult) =>
        Result.match(viewedSessionIdResult, {onFailure: () => Effect.void, onSuccess: showViewedSessionFolderShell})
      )
    )
  );
});

export const startFolderShellEndOnTerminalClose = Effect.fn("FolderShellService.startFolderShellEndOnTerminalClose")(
  function* () {
    const terminalInfraService = yield* ITerminalInfraService;
    const tmuxInfraService = yield* ITmuxInfraService;

    yield* Effect.forkScoped(
      Stream.runForEach(terminalInfraService.folderShellPathsClosedByUser, (closedFolderShellPath) =>
        tmuxInfraService.endFolderShell(closedFolderShellPath)
      )
    );
  }
);

// A worktree shown in the window is no project, so its shell takes the label of a session working there.
const prepareShownFolderShellRequest = Effect.fn("FolderShellService.prepareShownFolderShellRequest")(function* () {
  const workspaceFolderProjects = yield* IWorkspaceInfraService.use(
    (workspaceInfraService) => workspaceInfraService.listWorkspaceFolderProjects
  );
  const [shownFolder] = workspaceFolderProjects;
  if (shownFolder === undefined) return yield* NoShownFolderError.make();
  const [worktreeSession] = yield* findEntities(ISessionRepository, {worktreePath: shownFolder.path});
  if (worktreeSession !== undefined) return yield* prepareSessionFolderShellRequest(worktreeSession);
  const shownProject = yield* findProjectListItem(shownFolder.path);
  const folderShellRequest: FolderShellRequest = {folderPath: shownProject.path, statusLabel: shownProject.name};

  return folderShellRequest;
});

// The session in view picks the shell, as the follow would; with none in view, the folder shown in the window does.
const prepareProfileFolderShellRequest = Effect.fn("FolderShellService.prepareProfileFolderShellRequest")(function* () {
  const viewedSessionId = yield* ITerminalInfraService.use((terminalInfraService) =>
    SubscriptionRef.get(terminalInfraService.viewedSessionId)
  );
  if (Result.isFailure(viewedSessionId)) return yield* prepareShownFolderShellRequest();
  const viewedSession = yield* findSession(viewedSessionId.success);

  return yield* prepareSessionFolderShellRequest(viewedSession);
});

// VS Code opens its default terminal when the panel shows none and on every +: the first is the Aggregor terminal.
export const prepareProfileTerminal = Effect.fn("FolderShellService.prepareProfileTerminal")(function* () {
  const terminalInfraService = yield* ITerminalInfraService;
  const openFolderShellTerminal = yield* Effect.result(terminalInfraService.findFolderShellTerminalProcessId);
  if (Result.isSuccess(openFolderShellTerminal)) return ProfileTerminalDtoSchema.make({});
  const folderShellRequest = yield* prepareProfileFolderShellRequest();
  const terminalCommand = yield* ITmuxInfraService.use((tmuxInfraService) =>
    tmuxInfraService.prepareFolderShellTerminalCommand(folderShellRequest)
  );
  const folderShellTerminal = yield* terminalInfraService.prepareFolderShellTerminalOptions(terminalCommand);
  yield* terminalInfraService.assignShownFolderShellPath(folderShellRequest.folderPath);

  return ProfileTerminalDtoSchema.make({folderShellTerminal});
});
