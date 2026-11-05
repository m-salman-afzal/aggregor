// eslint-disable-next-line max-classes-per-file
import {Context} from "effect";

import type {SessionTitleNotFound} from "@/application/errors/harness.error.ts";
import type {Session} from "@/domain/entities/session/session.entity.ts";
import type {HarnessId} from "@/domain/value-objects/harness-id.value-object.ts";
import type {LaunchPlan} from "@/domain/value-objects/launch-plan.value-object.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Status} from "@/domain/value-objects/status.value-object.ts";
import type {Effect, LayerMap, SubscriptionRef} from "effect";

// One agent CLI, such as Claude Code: how to launch it, and what its sessions are doing and are called.
export class HarnessClient extends Context.Service<
  HarnessClient,
  {
    readonly clearSessionStatus: (sessionId: SessionId) => Effect.Effect<void>;
    readonly getSessionTitle: (sessionId: SessionId) => Effect.Effect<string, SessionTitleNotFound>;
    // The harness's icon file, for the session's tab and row.
    readonly iconPath: string;
    // Clears the session's last status and plans the launch: a resume when the agent has the conversation, else a
    // fresh start under the session's id.
    readonly prepareLaunch: (session: Session) => Effect.Effect<LaunchPlan>;
    readonly sessionStatuses: SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionId, Status>>;
    readonly sessionTitles: SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionId, string>>;
  }
>()("aggregor/application/clients/harness.client/HarnessClient") {}

// Each harness's client, by harness id; every session names its harness.
export class Harnesses extends Context.Service<Harnesses, LayerMap.LayerMap<HarnessId, HarnessClient>>()(
  "aggregor/application/clients/harness.client/Harnesses"
) {}
