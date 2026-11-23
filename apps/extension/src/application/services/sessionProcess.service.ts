import {Array, Context, Effect, Layer, Result, Schedule, Stream} from "effect";

import {
  FolderShellProcessesDtoSchema,
  SessionProcessesDtoSchema,
  TerminalProcessesDtoSchema
} from "@/dtos/sessionProcess.dto.ts";
import {ISessionRepository} from "@/entities/session/session.repository.interface.ts";
import {IProcessInfraService} from "@/interfaces/process.infraService.interface.ts";
import {ITmuxInfraService} from "@/interfaces/tmux.infraService.interface.ts";
import {BaseService} from "@/services/base.service.ts";
import {FolderShellService} from "@/services/folderShell.service.ts";
import {SessionService} from "@/services/session.service.ts";
import {SESSION_LIFECYCLES} from "@/valueObjects/sessionLifecycle.valueObject.ts";
import {PROCESS_SAMPLING} from "@pkg/constants/src/process.constant.ts";

import type {WatchSessionProcessesRequestDto} from "@/dtos/sessionProcess.dto.ts";
import type {SessionEntity} from "@/entities/session/session.entity.ts";
import type {TmuxSessionPanes} from "@/interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@/valueObjects/entityId.valueObject.ts";

export class SessionProcessService extends Context.Service<SessionProcessService>()(
  "aggregor-app/application/services/sessionProcess.service/SessionProcessService",
  {
    make: Effect.fn("SessionProcessService.make")(function* () {
      const sessionRepository = yield* ISessionRepository;
      const processInfraService = yield* IProcessInfraService;
      const tmuxInfraService = yield* ITmuxInfraService;
      const folderShellService = yield* FolderShellService;
      const sessionService = yield* SessionService;
      const baseService = yield* BaseService;
      const sessionBaseService = yield* baseService.makeFor(sessionRepository);

      const readTerminalProcesses = Effect.fn("SessionProcessService.readTerminalProcesses")(function* (
        tmuxSessionPanes: TmuxSessionPanes
      ) {
        const groupProcesses = yield* processInfraService.listGroupProcesses({
          hostProcessId: tmuxSessionPanes.tmuxServerProcessId,
          rootProcessIds: tmuxSessionPanes.paneProcessIds
        });

        return TerminalProcessesDtoSchema.make({processes: groupProcesses});
      });

      const countFolderShellSessions = Effect.fn("SessionProcessService.countFolderShellSessions")(function* (
        session: SessionEntity
      ) {
        const projectSessions = yield* sessionBaseService.findEntities({projectId: session.projectId});

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
        const folderShellRequest = yield* folderShellService.prepareSessionFolderShellRequest(session);
        const folderShellPanes = yield* tmuxInfraService.readFolderShellPanes(folderShellRequest.folderPath);
        const terminalProcesses = yield* readTerminalProcesses(folderShellPanes);

        return FolderShellProcessesDtoSchema.make({
          ...terminalProcesses,
          sharingSessionCount: yield* countFolderShellSessions(session),
          statusLabel: folderShellRequest.statusLabel
        });
      });

      const readSessionProcesses = Effect.fn("SessionProcessService.readSessionProcesses")(function* (
        sessionId: EntityIdValueObject
      ) {
        const session = yield* sessionService.findSession(sessionId);
        const agentPanes = yield* tmuxInfraService.readSessionAgentPanes(sessionId);
        const agentTerminal = yield* readTerminalProcesses(agentPanes);
        const folderShellResult = yield* Effect.result(readFolderShellProcesses(session));

        return SessionProcessesDtoSchema.make({
          agentTerminal,
          folderShell: Result.getOrUndefined(folderShellResult),
          sessionId
        });
      });

      const readWatchedSessionProcesses = Effect.fn("SessionProcessService.readWatchedSessionProcesses")(function* (
        watchRequest: WatchSessionProcessesRequestDto
      ) {
        const sessionProcessResults = yield* Effect.forEach(watchRequest.sessionIds, (sessionId) =>
          Effect.result(readSessionProcesses(sessionId))
        );

        return Array.getSuccesses(sessionProcessResults);
      });

      const watchSessionProcesses = Effect.fn("SessionProcessService.watchSessionProcesses")(function* (
        watchRequests: Stream.Stream<WatchSessionProcessesRequestDto>
      ) {
        const readProcesses = (watchRequest: WatchSessionProcessesRequestDto) =>
          Effect.withTracerEnabled(readWatchedSessionProcesses(watchRequest), false);

        return Stream.switchMap(watchRequests, (watchRequest) =>
          watchRequest.sessionIds.length === 0
            ? Stream.empty
            : Stream.flattenIterable(
                Stream.fromEffectSchedule(readProcesses(watchRequest), Schedule.spaced(PROCESS_SAMPLING.INTERVAL))
              )
        );
      });

      return {watchSessionProcesses};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([BaseService.layer, FolderShellService.layer, SessionService.layer])
  );
}
