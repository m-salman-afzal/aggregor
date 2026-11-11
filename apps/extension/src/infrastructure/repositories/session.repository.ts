import {SessionEntity} from "@entities/session/session.entity.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ProjectTableModel} from "@models/project.model.ts";
import {SessionTableModel} from "@models/session.model.ts";
import {makeBaseRepository} from "@repositories/base/base.repository.ts";
import {eq} from "drizzle-orm";
import {Effect, Layer} from "effect";

import type {AddSessionRequest} from "@entities/session/session.repository.interface.ts";

const sessionProjectJoin = {
  joinCondition: eq(ProjectTableModel.id, SessionTableModel.projectId),
  joinedColumns: {projectPath: ProjectTableModel.path},
  joinedTable: ProjectTableModel
};

// Sessions with their project's path.
const makeSessionRepository = Effect.fn("SessionRepository.make")(function* () {
  return yield* makeBaseRepository<SessionEntity, AddSessionRequest>({
    entitySchema: SessionEntity,
    join: sessionProjectJoin,
    tableModel: SessionTableModel
  });
});

export const SessionRepository = Layer.effect(ISessionRepository, makeSessionRepository());
