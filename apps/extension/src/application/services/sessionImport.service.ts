import {
  AgentImportableSessionsDtoSchema,
  ImportableSessionDtoSchema,
  ImportableSessionsDtoSchema
} from "@dtos/sessionImport.dto.ts";
import {IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IAgentHistoryInfraService} from "@interfaces/agentHistory.infraService.interface.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {BaseService} from "@services/base.service.ts";
import {ProjectService} from "@services/project.service.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {Array, Context, DateTime, Effect, Layer, Order} from "effect";

import type {
  ImportedSessionDto,
  ImportSessionsRequestDto,
  ListImportableSessionsRequestDto
} from "@dtos/sessionImport.dto.ts";
import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

export class SessionImportService extends Context.Service<SessionImportService>()(
  "aggregor-app/application/services/sessionImport.service/SessionImportService",
  {
    make: Effect.fn("make")(function* () {
      const agentRepository = yield* IAgentRepository;
      const sessionRepository = yield* ISessionRepository;
      const agentHistoryInfraService = yield* IAgentHistoryInfraService;
      const projectService = yield* ProjectService;
      const baseService = yield* BaseService;
      const sessionBaseService = yield* baseService.makeFor(sessionRepository);

      // A session Aggregor started gave the agent its own id, and an imported one keeps the agent's; removed ones are gone.
      const findKnownAgentSessionIds = Effect.fn("findKnownAgentSessionIds")(function* () {
        const storedSessions = yield* sessionBaseService.findEntities({});
        const knownAgentSessionIds: ReadonlySet<string> = new Set(
          Array.flatMap(storedSessions, (storedSession) =>
            Array.filter(
              [storedSession.id, storedSession.agentSessionId, storedSession.importedAgentSessionId],
              (agentSessionId) => agentSessionId !== undefined
            )
          )
        );

        return knownAgentSessionIds;
      });

      const toImportableSession = Effect.fn("toImportableSession")(function* (agentConversation: AgentConversation) {
        return ImportableSessionDtoSchema.make({
          agentSessionId: agentConversation.agentSessionId,
          title: agentConversation.title,
          updatedAt: DateTime.formatIso(DateTime.makeUnsafe(agentConversation.updatedAtMillis))
        });
      });

      const listAgentImportableSessions = Effect.fn("listAgentImportableSessions")(function* (
        agent: AgentEntity,
        folderPath: ProjectPathValueObject,
        knownAgentSessionIds: ReadonlySet<string>
      ) {
        const agentConversations = yield* agentHistoryInfraService.listAgentConversations(agent.id, folderPath);
        const newestFirst = Array.sort(
          Array.filter(
            agentConversations,
            (agentConversation) => !knownAgentSessionIds.has(agentConversation.agentSessionId)
          ),
          Order.flip(
            Order.mapInput(Order.Number, (agentConversation: AgentConversation) => agentConversation.updatedAtMillis)
          )
        );

        return AgentImportableSessionsDtoSchema.make({
          agentId: agent.id,
          agentName: agent.name,
          importableSessions: yield* Effect.forEach(newestFirst, toImportableSession)
        });
      });

      // An agent whose history isn't read, or can't be, offers nothing; its span says why.
      const listImportableSessions = Effect.fn("listImportableSessions")(function* (
        request: ListImportableSessionsRequestDto
      ) {
        const projectListItem = yield* projectService.findProjectListItem(request.projectPath);
        const agents = yield* agentRepository.findAll;
        const knownAgentSessionIds = yield* findKnownAgentSessionIds();
        const agentResults = yield* Effect.forEach(
          agents,
          (agent) => Effect.result(listAgentImportableSessions(agent, projectListItem.path, knownAgentSessionIds)),
          {concurrency: "unbounded"}
        );

        return ImportableSessionsDtoSchema.make({
          agentGroups: Array.filter(
            Array.getSuccesses(agentResults),
            (agentImportableSessions) => agentImportableSessions.importableSessions.length > 0
          ),
          projectPath: projectListItem.path
        });
      });

      const addImportedSession = Effect.fn("addImportedSession")(function* (
        projectId: EntityIdValueObject,
        importedSession: ImportedSessionDto
      ) {
        const agent = yield* agentRepository.findById(importedSession.agentId);

        return yield* sessionBaseService.addEntity({
          agentId: agent.id,
          importedAgentSessionId: importedSession.agentSessionId,
          lifecycle: SESSION_LIFECYCLES.ONGOING,
          name: importedSession.title,
          projectId
        });
      });

      // A conversation already a session, as from a second Import, isn't added twice; a project no longer listed gets none.
      const importSessions = Effect.fn("importSessions")(
        function* (request: ImportSessionsRequestDto) {
          const projectListItem = yield* projectService.findProjectListItem(request.projectPath);
          const project = yield* projectService.findOrAddProject(projectListItem.path);
          const knownAgentSessionIds = yield* findKnownAgentSessionIds();
          const newImportedSessions = Array.filter(
            request.importedSessions,
            (importedSession) => !knownAgentSessionIds.has(importedSession.agentSessionId)
          );
          yield* Effect.annotateCurrentSpan({
            alreadyImportedCount: request.importedSessions.length - newImportedSessions.length,
            importedCount: newImportedSessions.length
          });

          yield* Effect.forEach(newImportedSessions, (importedSession) =>
            addImportedSession(project.id, importedSession)
          );
        },
        Effect.catchTag("ProjectNotListedError", () => Effect.void)
      );

      return {importSessions, listImportableSessions};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionImportService", this.make())).pipe(
    Layer.provide([BaseService.layer, ProjectService.layer])
  );
}
