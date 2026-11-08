import {Context} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SubscriptionRef} from "effect";

export type AddSessionRequest = Pick<SessionEntity, "customName" | "harnessId" | "name" | "projectId">;

export class ISessionRepository extends Context.Service<
  ISessionRepository,
  {
    readonly sessions: SubscriptionRef.SubscriptionRef<readonly SessionEntity[]>;
  } & IBaseRepository<SessionEntity, AddSessionRequest>
>()("aggregor-app/domain/entities/session/session.repository.interface/ISessionRepository") {}
