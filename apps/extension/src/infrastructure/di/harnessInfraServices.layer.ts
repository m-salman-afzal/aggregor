import {IHarnessInfraServices} from "@/application/interfaces/harness.infraService.interface.ts";
import {ClaudeCodeHarnessInfraService} from "@/infrastructure/services/claudeCodeHarness/claudeCodeHarness.infraService.ts";
import {Effect, Layer, LayerMap} from "effect";

import type {IHarnessInfraService} from "@/application/interfaces/harness.infraService.interface.ts";
import type {HarnessIdValueObject} from "@/domain/valueObjects/harnessId.valueObject.ts";

// One infra service per harness id, so a harness id without one fails to compile.
const HARNESS_INFRA_SERVICE_LAYERS = {
  "claude-code": ClaudeCodeHarnessInfraService
} satisfies Record<HarnessIdValueObject, Layer.Layer<IHarnessInfraService, never, any>>;

// Every harness starts with the window and lives as long as it, since the view reads its statuses all the time.
const makeHarnessInfraServices = Effect.fn("HarnessInfraServices.make")(function* () {
  return yield* LayerMap.fromRecord(HARNESS_INFRA_SERVICE_LAYERS, {idleTimeToLive: "Infinity", preload: true});
});

export const HarnessInfraServicesLayer = Layer.effect(IHarnessInfraServices, makeHarnessInfraServices());
