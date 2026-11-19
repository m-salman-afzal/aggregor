import {
  FolderShellProcessesDtoSchema,
  SessionProcessesDtoSchema,
  TerminalProcessesDtoSchema
} from "@dtos/sessionProcess.dto.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IProcessInfraService} from "@interfaces/process.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {PROCESS_SAMPLING} from "@pkg/constants/src/process.constant.ts";
import {findEntities} from "@services/base.service.ts";
import {prepareSessionFolderShellRequest} from "@services/folderShell.service.ts";
import {findSession} from "@services/session.service.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {Array, Effect, Result, Schedule, Stream} from "effect";

import type {WatchSessionProcessesRequestDto} from "@dtos/sessionProcess.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {TmuxSessionPanes} from "@interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

const readTerminalProcesses = Effect.fn("SessionProcessService.readTerminalProcesses")(function* (
  tmuxSessionPanes: TmuxSessionPanes
) {
  const processInfraService = yield* IProcessInfraService;
  const groupProcesses = yield* processInfraService.listGroupProcesses({
    hostProcessId: tmuxSessionPanes.tmuxServerProcessId,
    rootProcessIds: tmuxSessionPanes.paneProcessIds
  });

  return TerminalProcessesDtoSchema.make({processes: groupProcesses});
});

// The sessions in the folder that the Sessions list shows, and this one, since an archived session opens it too.
const countFolderShellSessions = Effect.fn("SessionProcessService.countFolderShellSessions")(function* (
  session: SessionEntity
) {
  const projectSessions = yield* findEntities(ISessionRepository, {projectId: session.projectId});

  return Array.filter(
    projectSessions,
    (projectSession) =>
      projectSession.workingFolderPath === session.workingFolderPath &&
      (projectSession.lifecycle !== SESSION_LIFECYCLES.ARCHIVED || projectSession.id === session.id)
  ).length;
});

const readFolderShellProcesses = Effect.fn("SessionProcessService.readFolderShellProcesses")(function* (
  session: SessionEntity
) {
  const tmuxInfraService = yield* ITmuxInfraService;
  const folderShellRequest = yield* prepareSessionFolderShellRequest(session);
  const folderShellPanes = yield* tmuxInfraService.readFolderShellPanes(folderShellRequest.folderPath);
  const terminalProcesses = yield* readTerminalProcesses(folderShellPanes);

  return FolderShellProcessesDtoSchema.make({
    ...terminalProcesses,
    sharingSessionCount: yield* countFolderShellSessions(session),
    statusLabel: folderShellRequest.statusLabel
  });
});

// A folder shell that isn't running, or a project no longer listed, leaves the shell out.
const readSessionProcesses = Effect.fn("SessionProcessService.readSessionProcesses")(function* (
  sessionId: EntityIdValueObject
) {
  const tmuxInfraService = yield* ITmuxInfraService;
  const session = yield* findSession(sessionId);
  const agentPanes = yield* tmuxInfraService.readSessionAgentPanes(sessionId);
  const agentTerminal = yield* readTerminalProcesses(agentPanes);
  const folderShellResult = yield* Effect.result(readFolderShellProcesses(session));

  return SessionProcessesDtoSchema.make({
    agentTerminal,
    folderShell: Result.getOrUndefined(folderShellResult),
    sessionId
  });
});

// A session whose agent has ended has nothing to read; its dropdown closes with the agent.
const readWatchedSessionProcesses = Effect.fn("SessionProcessService.readWatchedSessionProcesses")(function* (
  watchRequest: WatchSessionProcessesRequestDto
) {
  const sessionProcessResults = yield* Effect.forEach(watchRequest.sessionIds, (sessionId) =>
    Effect.result(readSessionProcesses(sessionId))
  );

  return Array.getSuccesses(sessionProcessResults);
});

// Each request replaces the last, and the readings run untraced, as the database poll does.
export const watchSessionProcesses = Effect.fn("SessionProcessService.watchSessionProcesses")(function* (
  watchRequests: Stream.Stream<WatchSessionProcessesRequestDto>
) {
  const readingContext = yield* Effect.context<Effect.Services<ReturnType<typeof readWatchedSessionProcesses>>>();
  const readProcesses = (watchRequest: WatchSessionProcessesRequestDto) =>
    Effect.withTracerEnabled(Effect.provideContext(readWatchedSessionProcesses(watchRequest), readingContext), false);

  return Stream.switchMap(watchRequests, (watchRequest) =>
    watchRequest.sessionIds.length === 0
      ? Stream.empty
      : Stream.flattenIterable(
          Stream.fromEffectSchedule(readProcesses(watchRequest), Schedule.spaced(PROCESS_SAMPLING.INTERVAL))
        )
  );
});
