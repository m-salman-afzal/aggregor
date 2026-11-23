import {Array, Context, DateTime, Effect, Layer, Order} from "effect";

import {WorktreeListItemDtoSchema} from "@/dtos/session.dto.ts";
import {
  AgentImportableSessionsDtoSchema,
  ImportableSessionDtoSchema,
  ImportableSessionsDtoSchema
} from "@/dtos/sessionImport.dto.ts";
import {IAgentRepository} from "@/entities/agent/agent.repository.interface.ts";
import {ISessionRepository} from "@/entities/session/session.repository.interface.ts";
import {IAgentHistoryInfraService} from "@/interfaces/agentHistory.infraService.interface.ts";
import {IWorktreeInfraService} from "@/interfaces/worktree.infraService.interface.ts";
import {BaseService} from "@/services/base.service.ts";
import {ProjectService} from "@/services/project.service.ts";
import {SESSION_LIFECYCLES} from "@/valueObjects/sessionLifecycle.valueObject.ts";

import type {
  ImportedSessionDto,
  ImportSessionsRequestDto,
  ListImportableSessionsRequestDto
} from "@/dtos/sessionImport.dto.ts";
import type {AgentEntity} from "@/entities/agent/agent.entity.ts";
import type {AgentConversation} from "@/interfaces/agentHistory.infraService.interface.ts";
import type {GitWorktree} from "@/interfaces/worktree.infraService.interface.ts";
import type {EntityIdValueObject} from "@/valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";

interface ProjectFolder {
  readonly folderPath: ProjectPathValueObject;
  readonly worktree: GitWorktree | undefined;
}

interface FolderConversation {
  readonly agentConversation: AgentConversation;
  readonly worktree: GitWorktree | undefined;
}

export class SessionImportService extends Context.Service<SessionImportService>()(
  "aggregor-app/application/services/sessionImport.service/SessionImportService",
  {
    make: Effect.fn("SessionImportService.make")(function* () {
      const agentRepository = yield* IAgentRepository;
      const sessionRepository = yield* ISessionRepository;
      const agentHistoryInfraService = yield* IAgentHistoryInfraService;
      const worktreeInfraService = yield* IWorktreeInfraService;
      const projectService = yield* ProjectService;
      const baseService = yield* BaseService;
      const sessionBaseService = yield* baseService.makeForRepository(sessionRepository);

      // A session Aggregor started gave the agent its own id.
      const findKnownAgentSessionIds = Effect.fn("SessionImportService.findKnownAgentSessionIds")(function* () {
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

      const listProjectWorktrees = Effect.fn("SessionImportService.listProjectWorktrees")(
        function* (projectPath: ProjectPathValueObject) {
          const gitWorktrees = yield* worktreeInfraService.listWorktrees(projectPath);

          // git lists a project that is itself a linked worktree among its own worktrees.
          return Array.filter(gitWorktrees, (gitWorktree) => gitWorktree.worktreePath !== projectPath);
        },
        Effect.catchTag("NotGitRepositoryError", () => Effect.succeed(Array.empty<GitWorktree>()))
      );

      const listProjectFolders = Effect.fn("SessionImportService.listProjectFolders")(function* (
        projectPath: ProjectPathValueObject
      ) {
        const projectWorktrees = yield* listProjectWorktrees(projectPath);
        const projectFolders: readonly ProjectFolder[] = [
          {folderPath: projectPath, worktree: undefined},
          ...Array.map(projectWorktrees, (projectWorktree) => ({
            folderPath: projectWorktree.worktreePath,
            worktree: projectWorktree
          }))
        ];

        return projectFolders;
      });

      const makeImportableSession = Effect.fn("SessionImportService.makeImportableSession")(function* (
        folderConversation: FolderConversation
      ) {
        const worktree = folderConversation.worktree;

        return ImportableSessionDtoSchema.make({
          agentSessionId: folderConversation.agentConversation.agentSessionId,
          title: folderConversation.agentConversation.title,
          updatedAt: DateTime.formatIso(DateTime.makeUnsafe(folderConversation.agentConversation.updatedAtMillis)),
          worktree:
            worktree === undefined
              ? undefined
              : WorktreeListItemDtoSchema.make({
                  branchName: worktree.branchName,
                  worktreePath: worktree.worktreePath
                })
        });
      });

      const listFolderConversations = Effect.fn("SessionImportService.listFolderConversations")(function* (
        agent: AgentEntity,
        projectFolder: ProjectFolder
      ) {
        const agentConversations = yield* agentHistoryInfraService.listAgentConversations(
          agent.id,
          projectFolder.folderPath
        );

        return Array.map(agentConversations, (agentConversation): FolderConversation => ({
          agentConversation,
          worktree: projectFolder.worktree
        }));
      });

      const listAgentImportableSessions = Effect.fn("SessionImportService.listAgentImportableSessions")(function* (
        agent: AgentEntity,
        projectFolders: readonly ProjectFolder[],
        knownAgentSessionIds: ReadonlySet<string>
      ) {
        const folderResults = yield* Effect.forEach(
          projectFolders,
          (projectFolder) => Effect.result(listFolderConversations(agent, projectFolder)),
          {concurrency: "unbounded"}
        );
        const newestFirst = Array.sort(
          Array.filter(
            Array.flatten(Array.getSuccesses(folderResults)),
            (folderConversation) => !knownAgentSessionIds.has(folderConversation.agentConversation.agentSessionId)
          ),
          Order.flip(
            Order.mapInput(
              Order.Number,
              (folderConversation: FolderConversation) => folderConversation.agentConversation.updatedAtMillis
            )
          )
        );

        return AgentImportableSessionsDtoSchema.make({
          agentId: agent.id,
          agentName: agent.name,
          importableSessions: yield* Effect.forEach(newestFirst, makeImportableSession)
        });
      });

      const listImportableSessions = Effect.fn("SessionImportService.listImportableSessions")(function* (
        request: ListImportableSessionsRequestDto
      ) {
        const projectListItem = yield* projectService.findProjectListItem(request.projectPath);
        const agents = yield* agentRepository.findAll;
        const knownAgentSessionIds = yield* findKnownAgentSessionIds();
        const projectFolders = yield* listProjectFolders(projectListItem.path);
        const agentGroups = yield* Effect.forEach(
          agents,
          (agent) => listAgentImportableSessions(agent, projectFolders, knownAgentSessionIds),
          {concurrency: "unbounded"}
        );

        return ImportableSessionsDtoSchema.make({
          agentGroups: Array.filter(
            agentGroups,
            (agentImportableSessions) => agentImportableSessions.importableSessions.length > 0
          ),
          projectPath: projectListItem.path
        });
      });

      const addImportedSession = Effect.fn("SessionImportService.addImportedSession")(function* (
        projectId: EntityIdValueObject,
        importedSession: ImportedSessionDto
      ) {
        const agent = yield* agentRepository.findById(importedSession.agentId);

        return yield* sessionBaseService.addEntity({
          agentId: agent.id,
          importedAgentSessionId: importedSession.agentSessionId,
          lifecycle: SESSION_LIFECYCLES.ONGOING,
          name: importedSession.title,
          projectId,
          worktreePath: importedSession.worktreePath
        });
      });

      const importSessions = Effect.fn("SessionImportService.importSessions")(
        function* (request: ImportSessionsRequestDto) {
          const projectListItem = yield* projectService.findProjectListItem(request.projectPath);
          const project = yield* projectService.findOrAddProject(projectListItem.path);
          const knownAgentSessionIds = yield* findKnownAgentSessionIds();
          const projectWorktrees = yield* listProjectWorktrees(projectListItem.path);
          const projectWorktreePaths = new Set<string>(
            Array.map(projectWorktrees, (projectWorktree) => projectWorktree.worktreePath)
          );
          const newImportedSessions = Array.filter(
            request.importedSessions,
            (importedSession) => !knownAgentSessionIds.has(importedSession.agentSessionId)
          );
          const resumableImportedSessions = Array.filter(
            newImportedSessions,
            (importedSession) =>
              importedSession.worktreePath === undefined || projectWorktreePaths.has(importedSession.worktreePath)
          );
          yield* Effect.annotateCurrentSpan({
            alreadyImportedCount: request.importedSessions.length - newImportedSessions.length,
            importedCount: resumableImportedSessions.length,
            worktreeGoneCount: newImportedSessions.length - resumableImportedSessions.length
          });

          yield* Effect.forEach(resumableImportedSessions, (importedSession) =>
            addImportedSession(project.id, importedSession)
          );
        },
        Effect.catchTag("ProjectNotListedError", () => Effect.void)
      );

      return {importSessions, listImportableSessions};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([BaseService.layer, ProjectService.layer])
  );
}
