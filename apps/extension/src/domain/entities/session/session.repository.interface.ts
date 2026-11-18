import {Context} from "effect";

import type {IBaseRepository} from "@entities/base/base.repository.interface.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";

export type AddSessionRequest = Pick<
  SessionEntity,
  | "agentId"
  | "baseBranchName"
  | "customName"
  | "importedAgentSessionId"
  | "lifecycle"
  | "name"
  | "projectId"
  | "pullRequestNumber"
  | "runState"
  | "viewedAt"
  | "worktreePath"
>;

export class ISessionRepository extends Context.Service<
  ISessionRepository,
  IBaseRepository<SessionEntity, AddSessionRequest>
>()("aggregor-app/domain/entities/session/session.repository.interface/ISessionRepository") {}
