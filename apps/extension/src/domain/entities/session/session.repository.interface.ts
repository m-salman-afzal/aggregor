import {Context} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";

export type AddSessionRequest = Pick<SessionEntity, "customName" | "harnessId" | "name" | "projectId" | "viewedAt">;

export class ISessionRepository extends Context.Service<
  ISessionRepository,
  IBaseRepository<SessionEntity, AddSessionRequest>
>()("aggregor-app/domain/entities/session/session.repository.interface/ISessionRepository") {}
