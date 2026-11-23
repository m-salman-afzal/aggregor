import {eq} from "drizzle-orm";
import {Context, Effect, Layer} from "effect";

import {SessionEntity} from "@/entities/session/session.entity.ts";
import {ISessionRepository} from "@/entities/session/session.repository.interface.ts";
import {ProjectTableModel} from "@/models/project.model.ts";
import {SessionTableModel} from "@/models/session.model.ts";
import {BaseRepository} from "@/repositories/base/base.repository.ts";

import type {AddSessionRequest} from "@/entities/session/session.repository.interface.ts";

const sessionProjectJoin = {
  joinCondition: eq(ProjectTableModel.id, SessionTableModel.projectId),
  joinedColumns: {projectPath: ProjectTableModel.path},
  joinedTable: ProjectTableModel
};

export class SessionRepository extends Context.Service<SessionRepository>()(
  "aggregor-app/infrastructure/repositories/session.repository/SessionRepository",
  {
    make: Effect.fn("SessionRepository.make")(function* () {
      const baseRepository = yield* BaseRepository;

      return yield* baseRepository.makeForTable<SessionEntity, AddSessionRequest>({
        entitySchema: SessionEntity,
        join: sessionProjectJoin,
        tableModel: SessionTableModel
      });
    })
  }
) {
  public static readonly layer = Layer.effect(ISessionRepository, this.make()).pipe(
    Layer.provide(BaseRepository.layer)
  );
}
