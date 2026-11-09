import {Context} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {Effect, LayerMap} from "effect";

// The command that starts a session's agent, and its arguments.
export interface LaunchPlan {
  readonly command: string;
  readonly commandArguments: readonly string[];
}

// One agent CLI, such as Claude Code: how to launch it, and which titles it shows before a session has one.
export class IHarnessInfraService extends Context.Service<
  IHarnessInfraService,
  {
    // The harness's icon file, for the session's tab and row.
    readonly iconPath: string;
    // The titles the agent gives its terminal before it names the conversation, such as its own name.
    readonly placeholderTitles: ReadonlySet<string>;
    // A resume once the agent has worked on the session, else a fresh start under the session's id.
    readonly prepareLaunchPlan: (session: SessionEntity) => Effect.Effect<LaunchPlan>;
  }
>()("aggregor-app/application/interfaces/harness.infraService.interface/IHarnessInfraService") {}

// Each harness's infra service, by harness id; every session names its harness.
export class IHarnessInfraServices extends Context.Service<
  IHarnessInfraServices,
  LayerMap.LayerMap<HarnessIdValueObject, IHarnessInfraService>
>()("aggregor-app/application/interfaces/harness.infraService.interface/IHarnessInfraServices") {}
