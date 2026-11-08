import {Context} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";
import type {Effect, LayerMap, SubscriptionRef} from "effect";

// One agent CLI, such as Claude Code: how to launch it, what its sessions are doing, and which titles its terminals show
// before a session has one.
export class IHarnessInfraService extends Context.Service<
  IHarnessInfraService,
  {
    readonly clearSessionStatus: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
    // The harness's icon file, for the session's tab and row.
    readonly iconPath: string;
    // The mark the agent's terminal title starts with while it waits for the user.
    readonly idleTitleMark: string;
    // The titles the agent gives its terminal before it names the conversation, such as its own name.
    readonly placeholderTitles: ReadonlySet<string>;
    // Clears the session's last status and plans the launch: a resume when the agent has the conversation, else a
    // fresh start under the session's id.
    readonly prepareLaunch: (session: SessionEntity) => Effect.Effect<LaunchPlanValueObject>;
    readonly sessionStatuses: SubscriptionRef.SubscriptionRef<ReadonlyMap<EntityIdValueObject, StatusValueObject>>;
    // Marks the session idle when its turn ended without the agent reporting it, as when the user interrupts Claude.
    readonly settleSessionTurn: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/harness.infraService.interface/IHarnessInfraService") {}

// Each harness's infra service, by harness id; every session names its harness.
export class IHarnessInfraServices extends Context.Service<
  IHarnessInfraServices,
  LayerMap.LayerMap<HarnessIdValueObject, IHarnessInfraService>
>()("aggregor-app/application/interfaces/harness.infraService.interface/IHarnessInfraServices") {}
