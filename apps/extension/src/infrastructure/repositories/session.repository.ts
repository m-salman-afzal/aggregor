import {SessionEntity} from "@entities/session/session.entity.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {SessionTableModel} from "@models/session.model.ts";
import {makeBaseRepository} from "@repositories/base/base.repository.ts";
import {refreshOnDatabaseChanges} from "@repositories/base/repository.utils.ts";
import {showRepositoryError} from "@services/base.service.ts";
import {eq} from "drizzle-orm";
import {Context, Effect, Layer, SubscriptionRef} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {AddSessionRequest} from "@entities/session/session.repository.interface.ts";

type SessionBaseRepository = IBaseRepository<SessionEntity, AddSessionRequest>;

type SessionsReference = SubscriptionRef.SubscriptionRef<readonly SessionEntity[]>;

const SESSION_PROJECT_JOIN = {
  joinCondition: eq(ProjectTableModel.id, SessionTableModel.projectId),
  joinedColumns: {projectPath: ProjectTableModel.path},
  joinedTable: ProjectTableModel
};

const refreshSessions = Effect.fn("SessionRepository.refreshSessions")(function* (
  sessionBaseRepository: SessionBaseRepository,
  sessions: SessionsReference
) {
  const storedSessions = yield* sessionBaseRepository.findMany({});
  yield* SubscriptionRef.set(sessions, storedSessions);
}, Effect.catch(showRepositoryError));

const makeSessionRepository = Effect.fn("SessionRepository.make")(function* () {
  const sessionBaseRepository = yield* makeBaseRepository<SessionEntity, AddSessionRequest>({
    entitySchema: SessionEntity,
    join: SESSION_PROJECT_JOIN,
    tableModel: SessionTableModel
  });
  const sessions: SessionsReference = yield* SubscriptionRef.make<readonly SessionEntity[]>([]);
  const userInputPromptInfraService = yield* IUserInputPromptInfraService;
  const userInputPromptContext = Context.make(IUserInputPromptInfraService, userInputPromptInfraService);
  const refresh = Effect.provide(refreshSessions(sessionBaseRepository, sessions), userInputPromptContext);
  yield* refresh;
  yield* Effect.forkScoped(refreshOnDatabaseChanges(refresh));
  const refreshAfter = <Success, Failure>(write: Effect.Effect<Success, Failure>) => Effect.tap(write, () => refresh);

  return {
    ...sessionBaseRepository,
    add: (addRequest: AddSessionRequest) => refreshAfter(sessionBaseRepository.add(addRequest)),
    sessions,
    softDelete: (sessionId: SessionEntity["id"]) => refreshAfter(sessionBaseRepository.softDelete(sessionId)),
    update: (sessionId: SessionEntity["id"], changes: Partial<AddSessionRequest>) =>
      refreshAfter(sessionBaseRepository.update(sessionId, changes)),
    upsert: (addRequest: AddSessionRequest) => refreshAfter(sessionBaseRepository.upsert(addRequest))
  };
});

export const SessionRepository = Layer.effect(ISessionRepository, makeSessionRepository());
