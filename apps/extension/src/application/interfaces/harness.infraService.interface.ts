import {Context, Schema} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";
import type {Effect, LayerMap, SubscriptionRef} from "effect";

// The terminal title carries no session title: the agent has not named the conversation yet, or has exited.
export class SessionTitleNotFoundError extends Schema.TaggedError<
  SessionTitleNotFoundError,
  {readonly brand: unique symbol}
>()("SessionTitleNotFoundError", {}) {}

// One agent CLI, such as Claude Code: how to launch it, what its sessions are doing, and how it titles their terminals.
export class IHarnessInfraService extends Context.Service<
  IHarnessInfraService,
  {
    readonly clearSessionStatus: (sessionId: SessionIdValueObject) => Effect.Effect<void>;
    // The harness's icon file, for the session's tab and row.
    readonly iconPath: string;
    // Clears the session's last status and plans the launch: a resume when the agent has the conversation, else a
    // fresh start under the session's id.
    readonly prepareLaunch: (session: SessionEntity) => Effect.Effect<LaunchPlanValueObject>;
    // The session's title in the title the agent gives its terminal, without the agent's own decoration.
    readonly readSessionTitle: (terminalTitle: string) => Effect.Effect<string, SessionTitleNotFoundError>;
    readonly sessionStatuses: SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionIdValueObject, StatusValueObject>>;
  }
>()("aggregor-app/application/interfaces/harness.infraService.interface/IHarnessInfraService") {}

// Each harness's infra service, by harness id; every session names its harness.
export class IHarnessInfraServices extends Context.Service<
  IHarnessInfraServices,
  LayerMap.LayerMap<HarnessIdValueObject, IHarnessInfraService>
>()("aggregor-app/application/interfaces/harness.infraService.interface/IHarnessInfraServices") {}
