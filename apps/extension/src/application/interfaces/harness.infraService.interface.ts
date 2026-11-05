// eslint-disable-next-line max-classes-per-file
import {Context} from "effect";

import type {SessionTitleNotFoundError} from "@/application/errors/harness.infraService.error.ts";
import type {SessionEntity} from "@/domain/entities/session/session.entity.ts";
import type {HarnessIdValueObject} from "@/domain/valueObjects/harnessId.valueObject.ts";
import type {LaunchPlanValueObject} from "@/domain/valueObjects/launchPlan.valueObject.ts";
import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@/domain/valueObjects/status.valueObject.ts";
import type {Effect, LayerMap, SubscriptionRef} from "effect";

// One agent CLI, such as Claude Code: how to launch it, and what its sessions are doing and are called.
export class IHarnessInfraService extends Context.Service<
  IHarnessInfraService,
  {
    readonly clearSessionStatus: (sessionId: SessionIdValueObject) => Effect.Effect<void>;
    readonly getSessionTitle: (sessionId: SessionIdValueObject) => Effect.Effect<string, SessionTitleNotFoundError>;
    // The harness's icon file, for the session's tab and row.
    readonly iconPath: string;
    // Clears the session's last status and plans the launch: a resume when the agent has the conversation, else a
    // fresh start under the session's id.
    readonly prepareLaunch: (session: SessionEntity) => Effect.Effect<LaunchPlanValueObject>;
    readonly sessionStatuses: SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionIdValueObject, StatusValueObject>>;
    readonly sessionTitles: SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionIdValueObject, string>>;
  }
>()("aggregor/application/interfaces/harness.infraService.interface/IHarnessInfraService") {}

// Each harness's infra service, by harness id; every session names its harness.
export class IHarnessInfraServices extends Context.Service<
  IHarnessInfraServices,
  LayerMap.LayerMap<HarnessIdValueObject, IHarnessInfraService>
>()("aggregor/application/interfaces/harness.infraService.interface/IHarnessInfraServices") {}
